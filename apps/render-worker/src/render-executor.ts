import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";
import { getWorkerEnv } from "./env";
import {
  createMaterializationWorkspace,
  materializeRenderAssets,
} from "@spectral/render-assets";
import { planRenderArtifacts } from "@spectral/render-encode";
import { createBenchmarkRecorder, selectRenderSampleFrames } from "@spectral/render-parity";
import type { RenderSession } from "@spectral/render-session";

export type RenderExecutionResult = {
  outputStorageKey?: string | null;
  posterStorageKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type RenderPageBootstrapPayload = {
  protocolVersion: string;
  exportJob: {
    id: string;
    projectId: string;
    status: string;
    format: string;
    width: number;
    height: number;
    fps: number;
    durationMs: number | null;
  };
  runtime: {
    mode: string;
    fps: number;
    durationMs: number;
    frameCount: number;
    targetElementId: string;
  };
  media: {
    analysisId: string | null;
    analysis: unknown;
    assetBindings: Array<{
      role: string;
      assetId: string;
      kind: string;
      status: string;
      resolvedUrl: string | null;
    }>;
  };
  routes: {
    pagePath: string;
    bootstrapPath: string;
    projectEventsPath: string;
    exportEventsPath: string;
    internal: {
      sessionPath: string;
      heartbeatPath: string;
      stagePath: string;
      artifactsPath: string;
      finalizePath: string;
    };
  };
};

export type RenderExecutor = {
  execute(input: {
    exportJobId: string;
    attempt: number;
    workerId: string;
    renderPageUrl: string;
    renderBootstrapUrl: string;
  }): Promise<RenderExecutionResult>;
};

type StageUpdatePayload = {
  workerId: string;
  attempt: number;
  stage:
    | "assets_materializing"
    | "encoding"
    | "finalizing";
  progressPct?: number | null;
  message?: string | null;
  details?: Record<string, unknown>;
};

function buildRenderRequestInit(): RequestInit {
  return {
    headers: {
      accept: "text/html,application/json",
      "user-agent": "spectral-render-worker/1.0",
    },
  };
}

function buildInternalRequestInit(token: string): RequestInit {
  return {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
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

function assertBootstrapPayload(
  payload: unknown,
  exportJobId: string,
): RenderPageBootstrapPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new NonRetryableWorkerError(
      `Render bootstrap payload for ${exportJobId} is not an object.`,
      "INVALID_RENDER_BOOTSTRAP",
    );
  }

  const candidate = payload as Partial<RenderPageBootstrapPayload>;

  if (
    candidate.protocolVersion !== "spectral.render-page-bootstrap.v1" ||
    !candidate.exportJob ||
    candidate.exportJob.id !== exportJobId ||
    !candidate.runtime ||
    !candidate.media ||
    !candidate.routes
  ) {
    throw new NonRetryableWorkerError(
      `Render bootstrap payload for ${exportJobId} is missing required fields.`,
      "INVALID_RENDER_BOOTSTRAP",
    );
  }

  return candidate as RenderPageBootstrapPayload;
}

function assertRenderSession(payload: unknown, exportJobId: string): RenderSession {
  if (typeof payload !== "object" || payload === null) {
    throw new NonRetryableWorkerError(
      `Render session payload for ${exportJobId} is not an object.`,
      "INVALID_RENDER_SESSION",
    );
  }

  const candidate = payload as Partial<RenderSession>;

  if (
    candidate.protocolVersion !== "spectral.render-session.v1" ||
    candidate.exportJobId !== exportJobId ||
    !candidate.runtime ||
    !candidate.assets ||
    !candidate.output ||
    !candidate.routes
  ) {
    throw new NonRetryableWorkerError(
      `Render session payload for ${exportJobId} is missing required fields.`,
      "INVALID_RENDER_SESSION",
    );
  }

  return candidate as RenderSession;
}

async function fetchInternalRenderSession(input: {
  exportJobId: string;
  sessionUrl: string;
  token: string;
}): Promise<RenderSession> {
  const response = await fetch(input.sessionUrl, {
    ...buildInternalRequestInit(input.token),
    method: "GET",
  });

  if (!response.ok) {
    throw new RetryableWorkerError(
      `Render session ${input.sessionUrl} responded with ${response.status}.`,
      "RENDER_SESSION_BAD_STATUS",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new NonRetryableWorkerError(
      `Render session ${input.sessionUrl} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_RENDER_SESSION",
    );
  }

  return assertRenderSession(payload, input.exportJobId);
}

async function postStageUpdate(input: {
  url: string;
  token: string;
  payload: StageUpdatePayload;
}): Promise<void> {
  const response = await fetch(input.url, {
    ...buildInternalRequestInit(input.token),
    method: "POST",
    body: JSON.stringify(input.payload),
  });

  if (!response.ok) {
    throw new RetryableWorkerError(
      `Render stage update ${input.url} responded with ${response.status}.`,
      "RENDER_STAGE_BAD_STATUS",
    );
  }
}

export class HttpRenderExecutor implements RenderExecutor {
  async execute(input: {
    exportJobId: string;
    attempt: number;
    workerId: string;
    renderPageUrl: string;
    renderBootstrapUrl: string;
  }): Promise<RenderExecutionResult> {
    const env = getWorkerEnv();

    let renderPageResponse: Response;

    try {
      renderPageResponse = await fetch(input.renderPageUrl, buildRenderRequestInit());
    } catch (error) {
      throw new RetryableWorkerError(
        `Failed to reach render page ${input.renderPageUrl}: ${error instanceof Error ? error.message : String(error)}`,
        "RENDER_PAGE_UNREACHABLE",
      );
    }

    if (!renderPageResponse.ok) {
      throw new RetryableWorkerError(
        `Render page ${input.renderPageUrl} responded with ${renderPageResponse.status}.`,
        "RENDER_PAGE_BAD_STATUS",
      );
    }

    const renderPageHtml = await readResponseText(renderPageResponse);

    if (!renderPageHtml.includes("spectral-render-page-bootstrap")) {
      throw new NonRetryableWorkerError(
        `Render page ${input.renderPageUrl} did not expose the bootstrap script tag.`,
        "RENDER_PAGE_BOOTSTRAP_TAG_MISSING",
      );
    }

    let renderBootstrapResponse: Response;

    try {
      renderBootstrapResponse = await fetch(input.renderBootstrapUrl, buildRenderRequestInit());
    } catch (error) {
      throw new RetryableWorkerError(
        `Failed to reach render bootstrap ${input.renderBootstrapUrl}: ${error instanceof Error ? error.message : String(error)}`,
        "RENDER_BOOTSTRAP_UNREACHABLE",
      );
    }

    if (!renderBootstrapResponse.ok) {
      throw new RetryableWorkerError(
        `Render bootstrap ${input.renderBootstrapUrl} responded with ${renderBootstrapResponse.status}.`,
        "RENDER_BOOTSTRAP_BAD_STATUS",
      );
    }

    let payload: unknown;

    try {
      payload = await renderBootstrapResponse.json();
    } catch (error) {
      throw new NonRetryableWorkerError(
        `Render bootstrap ${input.renderBootstrapUrl} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        "INVALID_RENDER_BOOTSTRAP",
      );
    }

    const bootstrap = assertBootstrapPayload(payload, input.exportJobId);
    const internalToken = env.internalExportsToken;

    if (!internalToken) {
      throw new NonRetryableWorkerError(
        "INTERNAL_EXPORTS_TOKEN is required for render asset materialization and artifact reporting.",
        "INTERNAL_EXPORTS_TOKEN_MISSING",
      );
    }

    const internalSessionUrl = new URL(bootstrap.routes.internal.sessionPath, env.webBaseUrl).toString();
    const internalStageUrl = new URL(bootstrap.routes.internal.stagePath, env.webBaseUrl).toString();
    const session = await fetchInternalRenderSession({
      exportJobId: input.exportJobId,
      sessionUrl: internalSessionUrl,
      token: internalToken,
    });
    const benchmark = createBenchmarkRecorder(session, {
      workerId: input.workerId,
      attempt: input.attempt,
    });

    await postStageUpdate({
      url: internalStageUrl,
      token: internalToken,
      payload: {
        workerId: input.workerId,
        attempt: input.attempt,
        stage: "assets_materializing",
        progressPct: 10,
        message: "Materializing render assets.",
      },
    });

    const workspaceDir = await createMaterializationWorkspace(
      "spectral-render-assets-",
      env.renderTempDir,
    );
    const materializedAssets = await materializeRenderAssets({
      session,
      workspaceDir,
    });
    benchmark.mark("assets_materialized", {
      assetBindingCount: materializedAssets.assetBindings.length,
      fontCount: materializedAssets.fonts.length,
      warningCount: materializedAssets.warnings.length,
    });
    const plannedArtifacts = planRenderArtifacts({
      session,
    });
    const paritySamples = selectRenderSampleFrames({
      session,
    });
    benchmark.mark("artifacts_planned", {
      sampleFrameCount: paritySamples.length,
      thumbnailCount: plannedArtifacts.thumbnailArtifacts.length,
      previewCount: plannedArtifacts.previewArtifacts.length,
    });

    throw new NonRetryableWorkerError(
      `Render session ${input.exportJobId} is prepared, but Codex3 frame output consumption and encoder invocation are not wired yet.`,
      "RENDER_EXECUTION_NOT_IMPLEMENTED",
    );
  }
}
