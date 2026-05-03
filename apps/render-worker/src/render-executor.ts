import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  materializeRenderAssets,
  type MaterializedRenderAssets,
} from "@spectral/render-assets";
import {
  CommandEncoderDriver,
  runFfmpeg,
  validateRenderOutput,
  type EncodeRenderResult,
} from "@spectral/render-encode";
import type {
  ExportArtifactDescriptor,
  ExportJobStage,
  RenderSession,
} from "@spectral/render-session";

import {
  renderWithChromium,
  type ChromiumRenderResult,
} from "./chromium-renderer";
import { getWorkerEnv } from "./env";
import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";
import {
  startLocalAssetServer,
  type LocalAssetServer,
} from "./local-asset-server";
import { createOfflineRuntimeHost } from "./runtime-host";
import { uploadArtifactToStorage } from "./storage";

export type RenderExecutionResult = {
  outputStorageKey?: string | null;
  posterStorageKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type RenderExecutorStageUpdate = {
  stage: ExportJobStage;
  progressPct?: number | null;
  message?: string | null;
  details?: Record<string, unknown>;
};

export type RenderExecutorContext = {
  session: RenderSession;
  workDir: string;
  attempt: number;
  workerId: string;
  resolveUrl: (routePath: string) => string;
  setStage: (update: RenderExecutorStageUpdate) => Promise<void>;
  reportArtifact: (
    artifact: ExportArtifactDescriptor,
    message?: string | null,
  ) => Promise<void>;
  throwIfCancelled: (
    reason: string,
    options?: { force?: boolean },
  ) => Promise<void>;
};

export type RenderExecutor = {
  execute(context: RenderExecutorContext): Promise<RenderExecutionResult>;
};

type PipelineState = {
  materializedAssets: MaterializedRenderAssets | null;
  assetServer: LocalAssetServer | null;
  materializedSession: RenderSession | null;
  renderResult: ChromiumRenderResult | null;
  encodeResult: EncodeRenderResult | null;
  posterPath: string | null;
  runtimeHost: {
    bundlePath: string;
    hostPath: string;
    hostUrl: string;
  } | null;
  thumbnailPaths: Map<number, string>;
};

function buildRenderRequestInit(): RequestInit {
  return {
    headers: {
      accept: "text/html,application/json",
      "user-agent": "spectral-render-worker/1.0",
    },
  };
}

function inferOutputExtension(session: RenderSession): string {
  switch (session.output.format) {
    case "mov":
      return "mov";
    case "webm":
      return "webm";
    case "mp4":
    default:
      return "mp4";
  }
}

function getMaterializedAssetsRoot(workDir: string): string {
  return join(workDir, "materialized-assets");
}

function resolveVideoCodec(session: RenderSession): string {
  switch (session.output.videoCodec) {
    case "prores":
      return "prores_ks";
    case "vp9":
      return "libvpx-vp9";
    case "h264":
    default:
      return "libx264";
  }
}

function resolveAudioCodec(session: RenderSession): string {
  switch (session.output.audioCodec) {
    case "opus":
      return "libopus";
    case "aac":
    default:
      return "aac";
  }
}

function buildVideoFilter(session: RenderSession): string | null {
  switch (session.output.format) {
    case "mp4":
    case "mov":
      return "pad=ceil(iw/2)*2:ceil(ih/2)*2";
    case "webm":
    default:
      return null;
  }
}

function buildVideoEncodeArgs(input: {
  session: RenderSession;
  framePattern: string;
  outputPath: string;
  audioPath?: string | null;
}): string[] {
  const args = [
    "-y",
    "-framerate",
    String(input.session.runtime.fps),
    "-start_number",
    "0",
    "-i",
    input.framePattern,
  ];

  if (input.audioPath) {
    args.push("-i", input.audioPath);
  }

  args.push("-map", "0:v:0");

  if (input.audioPath) {
    args.push("-map", "1:a:0");
  }

  const videoFilter = buildVideoFilter(input.session);

  if (videoFilter) {
    args.push("-vf", videoFilter);
  }

  args.push("-r", String(input.session.runtime.fps));
  args.push("-c:v", resolveVideoCodec(input.session));

  if (input.session.output.format === "mov") {
    args.push("-profile:v", "3", "-pix_fmt", "yuv422p10le");
  } else {
    args.push("-pix_fmt", "yuv420p");
  }

  if (input.session.output.format === "webm") {
    args.push("-b:v", "0", "-crf", "18", "-row-mt", "1");
  }

  if (input.audioPath) {
    args.push("-c:a", resolveAudioCodec(input.session), "-shortest");
  } else {
    args.push("-an");
  }

  if (input.session.output.format === "mp4") {
    args.push("-movflags", "+faststart");
  }

  args.push(input.outputPath);

  return args;
}

async function writeJsonFile(targetPath: string, payload: unknown) {
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function withMaterializedAssetUrls(
  session: RenderSession,
  assets: MaterializedRenderAssets,
  assetServer: LocalAssetServer,
): RenderSession {
  const assetBindings = session.assets.bindings.map(
    (binding: RenderSession["assets"]["bindings"][number]) => {
      const materializedBinding = assets.assetBindings.find(
        (candidate) =>
          candidate.assetId === binding.assetId &&
          candidate.role === binding.role,
      );

      if (!materializedBinding?.localPath) {
        return binding;
      }

      return {
        ...binding,
        resolvedUrl: assetServer.urlForPath(materializedBinding.localPath),
      };
    },
  );
  const fonts = session.assets.fonts.map(
    (font: RenderSession["assets"]["fonts"][number]) => {
      const materializedFont = assets.fonts.find(
        (candidate) =>
          candidate.family === font.family &&
          candidate.assetId === font.assetId &&
          candidate.weight === font.weight &&
          candidate.style === font.style,
      );

      if (!materializedFont?.localPath) {
        return font;
      }

      return {
        ...font,
        resolvedUrl: assetServer.urlForPath(materializedFont.localPath),
      };
    },
  );

  return {
    ...session,
    assets: {
      ...session.assets,
      bindings: assetBindings,
      fonts,
    },
  };
}

function findAudioAssetPath(
  assets: MaterializedRenderAssets | null,
): string | null {
  if (!assets) {
    return null;
  }

  const binding = assets.assetBindings.find(
    (candidate) => candidate.role === "audio" && candidate.localPath,
  );

  return binding?.localPath ?? null;
}

function getPreviewFramePath(
  state: PipelineState,
  artifact: ExportArtifactDescriptor,
): string | null {
  const frame =
    typeof artifact.metadata?.frame === "number"
      ? artifact.metadata.frame
      : null;

  if (frame === null) {
    return null;
  }

  return state.renderResult?.previewFramePaths.get(frame) ?? null;
}

async function generateJpegDerivative(input: {
  sourcePath: string;
  outputPath: string;
  workingDirectory: string;
  ffmpegBin: string;
}) {
  await runFfmpeg({
    ffmpegBin: input.ffmpegBin,
    cwd: input.workingDirectory,
    args: [
      "-y",
      "-i",
      input.sourcePath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      input.outputPath,
    ],
  });
}

async function uploadAndReportArtifact(
  context: RenderExecutorContext,
  input: {
    filePath: string;
    artifact: ExportArtifactDescriptor;
    message: string;
  },
): Promise<ExportArtifactDescriptor> {
  await context.throwIfCancelled(`uploading ${input.artifact.kind}`);

  const uploaded = await uploadArtifactToStorage({
    filePath: input.filePath,
    artifact: input.artifact,
  });

  await context.reportArtifact(uploaded.artifact, input.message);

  return uploaded.artifact;
}

export class PipelineRenderExecutor implements RenderExecutor {
  async execute(
    context: RenderExecutorContext,
  ): Promise<RenderExecutionResult> {
    const state: PipelineState = {
      materializedAssets: null,
      assetServer: null,
      materializedSession: null,
      renderResult: null,
      encodeResult: null,
      posterPath: null,
      runtimeHost: null,
      thumbnailPaths: new Map(),
    };

    try {
      await context.setStage({
        stage: "assets_preflight",
        progressPct: 5,
        message: "Validating render session inputs.",
        details: {
          workDir: context.workDir,
        },
      });
      await context.throwIfCancelled("validating assets", {
        force: true,
      });
      await this.runAssetPreflight(context);

      await context.setStage({
        stage: "assets_materializing",
        progressPct: 15,
        message: "Materializing render assets.",
        details: {
          workDir: context.workDir,
        },
      });
      await context.throwIfCancelled("materializing assets");
      await this.runAssetMaterialization(context, state);

      await context.setStage({
        stage: "renderer_warmup",
        progressPct: 30,
        message: "Preparing offline render runtime.",
        details: {
          workDir: context.workDir,
        },
      });
      await context.throwIfCancelled("warming up the renderer");
      await this.runRendererWarmup(context, state);

      await context.setStage({
        stage: "rendering",
        progressPct: 45,
        message: "Render pipeline entered frame production stage.",
        details: {
          frameCount: context.session.runtime.frameCount,
          durationMs: context.session.runtime.durationMs,
        },
      });
      await context.throwIfCancelled("starting the render pipeline");
      await this.runRendering(context, state);

      await context.setStage({
        stage: "encoding",
        progressPct: 70,
        message: "Encoding rendered output.",
      });
      await this.runEncoding(context, state);

      await context.setStage({
        stage: "uploading",
        progressPct: 85,
        message: "Uploading render artifacts.",
      });
      return this.runUploading(context, state);
    } finally {
      await state.assetServer?.close().catch(() => {});
    }
  }

  private async runAssetPreflight(context: RenderExecutorContext) {
    const unavailableBindings = context.session.assets.bindings.filter(
      (binding: RenderSession["assets"]["bindings"][number]) =>
        binding.status !== "ready",
    );

    if (unavailableBindings.length > 0) {
      const hasPending = unavailableBindings.some(
        (binding: RenderSession["assets"]["bindings"][number]) =>
          binding.status === "pending",
      );
      const ErrorCtor = hasPending
        ? RetryableWorkerError
        : NonRetryableWorkerError;

      throw new ErrorCtor(
        "Render session contains unresolved asset bindings.",
        {
          code: hasPending
            ? "ASSET_BINDINGS_PENDING"
            : "ASSET_BINDINGS_UNAVAILABLE",
          stage: "assets_preflight",
          details: {
            bindings: unavailableBindings.map(
              (binding: RenderSession["assets"]["bindings"][number]) => ({
                assetId: binding.assetId,
                role: binding.role,
                status: binding.status,
              }),
            ),
          },
        },
      );
    }

    await writeJsonFile(join(context.workDir, "assets", "preflight.json"), {
      sessionId: context.session.sessionId,
      bindings: context.session.assets.bindings,
      fonts: context.session.assets.fonts,
      audioAnalysis: context.session.assets.audioAnalysis,
    });
  }

  private async runAssetMaterialization(
    context: RenderExecutorContext,
    state: PipelineState,
  ) {
    const materializedAssetsRoot = getMaterializedAssetsRoot(context.workDir);
    const materializedAssets = await materializeRenderAssets({
      session: context.session,
      workspaceDir: materializedAssetsRoot,
    });
    const assetServer = await startLocalAssetServer({
      rootDir: materializedAssetsRoot,
    });
    const materializedSession = withMaterializedAssetUrls(
      context.session,
      materializedAssets,
      assetServer,
    );

    state.materializedAssets = materializedAssets;
    state.assetServer = assetServer;
    state.materializedSession = materializedSession;

    await writeJsonFile(
      join(context.workDir, "assets", "materialization-plan.json"),
      {
        exportJobId: context.session.exportJobId,
        materializedAssetsRoot,
        assetServerBaseUrl: assetServer.baseUrl,
        warnings: materializedAssets.warnings,
        bindings: materializedAssets.assetBindings,
        fonts: materializedAssets.fonts,
        audioAnalysis: materializedAssets.audioAnalysis,
      },
    );
  }

  private async runRendererWarmup(
    context: RenderExecutorContext,
    state: PipelineState,
  ) {
    const runtimeHost = await createOfflineRuntimeHost({
      workDir: context.workDir,
    });
    let renderBootstrapResponse: Response;
    const renderBootstrapUrl = context.resolveUrl(
      context.session.routes.public.bootstrapPath,
    );

    try {
      renderBootstrapResponse = await fetch(
        renderBootstrapUrl,
        buildRenderRequestInit(),
      );
    } catch (error) {
      throw new RetryableWorkerError(
        `Failed to reach render bootstrap ${renderBootstrapUrl}: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "RENDER_BOOTSTRAP_UNREACHABLE",
          stage: "renderer_warmup",
          cause: error,
        },
      );
    }

    if (!renderBootstrapResponse.ok) {
      throw new RetryableWorkerError(
        `Render bootstrap ${renderBootstrapUrl} responded with ${renderBootstrapResponse.status}.`,
        {
          code: "RENDER_BOOTSTRAP_BAD_STATUS",
          stage: "renderer_warmup",
          details: {
            status: renderBootstrapResponse.status,
          },
        },
      );
    }

    let bootstrapPayload: unknown;

    try {
      bootstrapPayload = await renderBootstrapResponse.json();
    } catch (error) {
      throw new NonRetryableWorkerError(
        `Render bootstrap ${renderBootstrapUrl} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "INVALID_RENDER_BOOTSTRAP",
          stage: "renderer_warmup",
          cause: error,
        },
      );
    }

    await writeJsonFile(
      join(context.workDir, "diagnostics", "bootstrap.json"),
      {
        runtimeHost,
        bootstrapUrl: renderBootstrapUrl,
        bootstrapPayload,
      },
    );

    state.runtimeHost = runtimeHost;
  }

  private async runRendering(
    context: RenderExecutorContext,
    state: PipelineState,
  ): Promise<void> {
    const sessionForRender = state.materializedSession ?? context.session;
    const workerEnv = getWorkerEnv();
    const renderPageUrl = state.runtimeHost?.hostUrl;

    if (!renderPageUrl) {
      throw new NonRetryableWorkerError(
        "Offline runtime host was not prepared before rendering.",
        {
          code: "OFFLINE_RUNTIME_HOST_MISSING",
          stage: "rendering",
        },
      );
    }
    const frameUpdateInterval = Math.max(
      1,
      Math.floor(context.session.runtime.frameCount / 20),
    );
    const renderResult = await renderWithChromium({
      executablePath: workerEnv.chromiumExecutablePath,
      workDir: context.workDir,
      renderPageUrl,
      session: context.session,
      sessionOverride: sessionForRender,
      throwIfCancelled: async (reason) => context.throwIfCancelled(reason),
      onFrameRendered: async ({ frame, frameCount, renderMs }) => {
        if (
          (frame + 1) % frameUpdateInterval !== 0 &&
          frame + 1 !== frameCount
        ) {
          return;
        }

        const frameProgress = Math.round(((frame + 1) / frameCount) * 20);

        await context.setStage({
          stage: "rendering",
          progressPct: Math.min(69, 45 + frameProgress),
          message: `Rendered frame ${frame + 1} of ${frameCount}.`,
          details: {
            currentFrame: frame + 1,
            frameCount,
            renderMs,
          },
        });
      },
    });

    state.renderResult = renderResult;

    await writeJsonFile(
      join(context.workDir, "diagnostics", "render-benchmark.json"),
      renderResult.benchmark,
    );
    await writeJsonFile(
      join(context.workDir, "diagnostics", "sample-frame-fingerprints.json"),
      renderResult.sampleFingerprints,
    );

    await state.assetServer?.close().catch(() => {});
    state.assetServer = null;
  }

  private async runEncoding(
    context: RenderExecutorContext,
    state: PipelineState,
  ): Promise<void> {
    if (!state.renderResult) {
      throw new NonRetryableWorkerError(
        "Rendering did not produce a frame sequence.",
        {
          code: "RENDER_OUTPUT_MISSING",
          stage: "encoding",
        },
      );
    }

    const workerEnv = getWorkerEnv();
    const outputPath = join(
      context.workDir,
      "encoded",
      `export.${inferOutputExtension(context.session)}`,
    );
    const audioPath = findAudioAssetPath(state.materializedAssets);
    const encoder = new CommandEncoderDriver({
      command: workerEnv.ffmpegBin,
      createArgs: (input) =>
        buildVideoEncodeArgs({
          session: input.session,
          framePattern: state.renderResult!.framePattern,
          outputPath: input.outputPath,
          audioPath,
        }),
    });
    const encodeResult = await encoder.encode({
      session: context.session,
      outputPath,
      workingDirectory: context.workDir,
    });

    let posterPath: string | null = null;

    if (context.session.output.posterFrame !== null) {
      const sourceFramePath = join(
        state.renderResult.framesDir,
        `frame-${String(context.session.output.posterFrame).padStart(6, "0")}.png`,
      );

      posterPath = join(context.workDir, "encoded", "poster.jpg");
      await generateJpegDerivative({
        sourcePath: sourceFramePath,
        outputPath: posterPath,
        workingDirectory: context.workDir,
        ffmpegBin: workerEnv.ffmpegBin,
      });
    }

    if (context.session.output.thumbnailFrames.length > 0) {
      await mkdir(join(context.workDir, "encoded", "thumbnails"), {
        recursive: true,
      });
    }

    for (const frame of context.session.output.thumbnailFrames) {
      const sourceFramePath = join(
        state.renderResult.framesDir,
        `frame-${String(frame).padStart(6, "0")}.png`,
      );
      const thumbnailPath = join(
        context.workDir,
        "encoded",
        "thumbnails",
        `thumbnail-${String(frame).padStart(6, "0")}.jpg`,
      );

      await generateJpegDerivative({
        sourcePath: sourceFramePath,
        outputPath: thumbnailPath,
        workingDirectory: context.workDir,
        ffmpegBin: workerEnv.ffmpegBin,
      });
      state.thumbnailPaths.set(frame, thumbnailPath);
    }

    const validation = await validateRenderOutput({
      session: context.session,
      outputPath,
      posterPath,
    });

    state.posterPath = posterPath;
    state.encodeResult = {
      ...encodeResult,
      posterPath,
      validation,
      metadata: {
        ...encodeResult.metadata,
        audioPath,
        thumbnailCount: state.thumbnailPaths.size,
      },
    };

    await writeJsonFile(join(context.workDir, "diagnostics", "encoding.json"), {
      outputPath,
      posterPath,
      validation,
      metadata: state.encodeResult.metadata,
    });
  }

  private async runUploading(
    context: RenderExecutorContext,
    state: PipelineState,
  ): Promise<RenderExecutionResult> {
    if (!state.encodeResult) {
      throw new NonRetryableWorkerError(
        "Encoding did not produce uploadable artifacts.",
        {
          code: "ENCODE_OUTPUT_MISSING",
          stage: "uploading",
        },
      );
    }

    const uploadedFinalArtifact = await uploadAndReportArtifact(context, {
      filePath: state.encodeResult.outputPath,
      artifact: state.encodeResult.artifacts.finalArtifact,
      message: "Uploaded final export artifact.",
    });

    let uploadedPosterArtifact: ExportArtifactDescriptor | null = null;

    if (state.encodeResult.artifacts.posterArtifact && state.posterPath) {
      uploadedPosterArtifact = await uploadAndReportArtifact(context, {
        filePath: state.posterPath,
        artifact: state.encodeResult.artifacts.posterArtifact,
        message: "Uploaded poster artifact.",
      });
    }

    for (const artifact of state.encodeResult.artifacts.previewArtifacts) {
      const filePath = getPreviewFramePath(state, artifact);

      if (!filePath) {
        continue;
      }

      await uploadAndReportArtifact(context, {
        filePath,
        artifact,
        message: "Uploaded preview frame artifact.",
      });
    }

    for (const artifact of state.encodeResult.artifacts.thumbnailArtifacts) {
      const frame =
        typeof artifact.metadata?.frame === "number"
          ? artifact.metadata.frame
          : null;
      const filePath =
        frame === null ? null : (state.thumbnailPaths.get(frame) ?? null);

      if (!filePath) {
        continue;
      }

      await uploadAndReportArtifact(context, {
        filePath,
        artifact,
        message: "Uploaded thumbnail artifact.",
      });
    }

    const metadata = {
      render: {
        benchmark: state.renderResult?.benchmark ?? null,
        sampleFingerprints: state.renderResult?.sampleFingerprints ?? [],
      },
      encoding: {
        validation: state.encodeResult.validation,
        metadata: state.encodeResult.metadata,
      },
      assets: {
        warnings: state.materializedAssets?.warnings ?? [],
      },
    };

    await writeJsonFile(join(context.workDir, "diagnostics", "uploads.json"), {
      outputStorageKey: uploadedFinalArtifact.storageKey,
      posterStorageKey: uploadedPosterArtifact?.storageKey ?? null,
      metadata,
    });

    return {
      outputStorageKey: uploadedFinalArtifact.storageKey,
      posterStorageKey: uploadedPosterArtifact?.storageKey ?? null,
      metadata,
    };
  }
}
