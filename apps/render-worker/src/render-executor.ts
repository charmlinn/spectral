import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";

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
  };
};

export type RenderExecutor = {
  execute(input: {
    exportJobId: string;
    renderPageUrl: string;
    renderBootstrapUrl: string;
  }): Promise<RenderExecutionResult>;
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

export class HttpRenderExecutor implements RenderExecutor {
  async execute(input: {
    exportJobId: string;
    renderPageUrl: string;
    renderBootstrapUrl: string;
  }): Promise<RenderExecutionResult> {
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

    throw new NonRetryableWorkerError(
      `Render page bootstrap loaded for ${input.exportJobId}, but browser rendering and video encoding are not wired yet. Bootstrap path: ${bootstrap.routes.bootstrapPath}.`,
      "RENDER_EXECUTION_NOT_IMPLEMENTED",
    );
  }
}
