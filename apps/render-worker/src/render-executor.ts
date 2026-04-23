import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ExportArtifactDescriptor,
  ExportJobStage,
  RenderSession,
} from "@spectral/render-session";

import {
  NonRetryableWorkerError,
  RetryableWorkerError,
} from "./errors";

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
  throwIfCancelled: (reason: string, options?: { force?: boolean }) => Promise<void>;
};

export type RenderExecutor = {
  execute(context: RenderExecutorContext): Promise<RenderExecutionResult>;
};

function buildRenderRequestInit(): RequestInit {
  return {
    headers: {
      accept: "text/html,application/json",
      "user-agent": "spectral-render-worker/1.0",
    },
  };
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function writeJsonFile(targetPath: string, payload: unknown) {
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export class PipelineRenderExecutor implements RenderExecutor {
  async execute(context: RenderExecutorContext): Promise<RenderExecutionResult> {
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
      message: "Preparing asset materialization plan.",
      details: {
        workDir: context.workDir,
      },
    });
    await context.throwIfCancelled("planning asset materialization");
    await this.runAssetMaterialization(context);

    await context.setStage({
      stage: "renderer_warmup",
      progressPct: 30,
      message: "Checking render entrypoints.",
      details: {
        pagePath: context.session.routes.public.pagePath,
        bootstrapPath: context.session.routes.public.bootstrapPath,
      },
    });
    await context.throwIfCancelled("warming up the renderer");
    await this.runRendererWarmup(context);

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
    await this.runRendering(context);

    await context.setStage({
      stage: "encoding",
      progressPct: 70,
      message: "Encoding rendered output.",
    });
    await this.runEncoding(context);

    await context.setStage({
      stage: "uploading",
      progressPct: 85,
      message: "Uploading render artifacts.",
    });
    return this.runUploading(context);
  }

  private async runAssetPreflight(context: RenderExecutorContext) {
    const unavailableBindings = context.session.assets.bindings.filter(
      (binding) => binding.status !== "ready",
    );

    if (unavailableBindings.length > 0) {
      const hasPending = unavailableBindings.some((binding) => binding.status === "pending");
      const ErrorCtor = hasPending ? RetryableWorkerError : NonRetryableWorkerError;

      throw new ErrorCtor("Render session contains unresolved asset bindings.", {
        code: hasPending ? "ASSET_BINDINGS_PENDING" : "ASSET_BINDINGS_UNAVAILABLE",
        stage: "assets_preflight",
        details: {
          bindings: unavailableBindings.map((binding) => ({
            assetId: binding.assetId,
            role: binding.role,
            status: binding.status,
          })),
        },
      });
    }

    await writeJsonFile(join(context.workDir, "assets", "preflight.json"), {
      sessionId: context.session.sessionId,
      bindings: context.session.assets.bindings,
      fonts: context.session.assets.fonts,
      audioAnalysis: context.session.assets.audioAnalysis,
    });
  }

  private async runAssetMaterialization(context: RenderExecutorContext) {
    await writeJsonFile(
      join(context.workDir, "assets", "materialization-plan.json"),
      {
        exportJobId: context.session.exportJobId,
        bindings: context.session.assets.bindings.map((binding) => ({
          assetId: binding.assetId,
          storageKey: binding.storageKey,
          resolvedUrl: binding.resolvedUrl,
          role: binding.role,
        })),
        fonts: context.session.assets.fonts,
      },
    );
  }

  private async runRendererWarmup(context: RenderExecutorContext) {
    const renderPageUrl = context.resolveUrl(context.session.routes.public.pagePath);
    const renderBootstrapUrl = context.resolveUrl(
      context.session.routes.public.bootstrapPath,
    );

    let renderPageResponse: Response;

    try {
      renderPageResponse = await fetch(renderPageUrl, buildRenderRequestInit());
    } catch (error) {
      throw new RetryableWorkerError(
        `Failed to reach render page ${renderPageUrl}: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "RENDER_PAGE_UNREACHABLE",
          stage: "renderer_warmup",
          cause: error,
        },
      );
    }

    if (!renderPageResponse.ok) {
      throw new RetryableWorkerError(
        `Render page ${renderPageUrl} responded with ${renderPageResponse.status}.`,
        {
          code: "RENDER_PAGE_BAD_STATUS",
          stage: "renderer_warmup",
          details: {
            status: renderPageResponse.status,
          },
        },
      );
    }

    const renderPageHtml = await readResponseText(renderPageResponse);

    if (!renderPageHtml.includes("spectral-render-page-bootstrap")) {
      throw new NonRetryableWorkerError(
        `Render page ${renderPageUrl} did not expose the bootstrap script tag.`,
        {
          code: "RENDER_PAGE_BOOTSTRAP_TAG_MISSING",
          stage: "renderer_warmup",
        },
      );
    }

    let renderBootstrapResponse: Response;

    try {
      renderBootstrapResponse = await fetch(renderBootstrapUrl, buildRenderRequestInit());
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

    await writeJsonFile(join(context.workDir, "diagnostics", "bootstrap.json"), {
      pageUrl: renderPageUrl,
      bootstrapUrl: renderBootstrapUrl,
      bootstrapPayload,
    });
  }

  private async runRendering(_: RenderExecutorContext): Promise<void> {
    throw new NonRetryableWorkerError(
      "Render pipeline stages are wired, but frame rendering is not implemented yet.",
      {
        code: "RENDER_PIPELINE_NOT_IMPLEMENTED",
        stage: "rendering",
      },
    );
  }

  private async runEncoding(_: RenderExecutorContext): Promise<void> {
    throw new NonRetryableWorkerError(
      "Encoding stage is not implemented yet.",
      {
        code: "ENCODER_NOT_IMPLEMENTED",
        stage: "encoding",
      },
    );
  }

  private async runUploading(_: RenderExecutorContext): Promise<RenderExecutionResult> {
    throw new NonRetryableWorkerError(
      "Artifact upload stage is not implemented yet.",
      {
        code: "UPLOAD_NOT_IMPLEMENTED",
        stage: "uploading",
      },
    );
  }
}
