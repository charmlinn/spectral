import {
  renderSessionSchema,
  type ExportArtifactCreatedPayload,
  type ExportJobFinalizePayload,
  type ExportJobStage,
  type ExportJobStageUpdatePayload,
  type RenderSession,
  type WorkerHeartbeatPayload,
} from "@spectral/render-session";

import {
  NonRetryableWorkerError,
  RetryableWorkerError,
} from "./errors";

export type RenderWorkerJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type RenderWorkerJobSnapshot = {
  exportJobId: string;
  status: RenderWorkerJobStatus;
  progressPct: number | null;
  stage: ExportJobStage | null;
};

export type RenderWorkerSessionClient = {
  fetchSession(exportJobId: string): Promise<RenderSession>;
  getJobSnapshot(session: RenderSession): Promise<RenderWorkerJobSnapshot>;
  reportHeartbeat(
    session: RenderSession,
    payload: WorkerHeartbeatPayload,
  ): Promise<void>;
  updateStage(
    session: RenderSession,
    payload: ExportJobStageUpdatePayload,
  ): Promise<void>;
  createArtifact(
    session: RenderSession,
    payload: ExportArtifactCreatedPayload,
  ): Promise<void>;
  finalize(session: RenderSession, payload: ExportJobFinalizePayload): Promise<void>;
  resolveUrl(routePath: string): string;
};

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function toJobStatus(value: unknown): RenderWorkerJobStatus | null {
  switch (value) {
    case "queued":
    case "running":
    case "completed":
    case "failed":
    case "cancelled":
      return value;
    default:
      return null;
  }
}

function toStage(value: unknown): ExportJobStage | null {
  switch (value) {
    case "session_ready":
    case "assets_preflight":
    case "assets_materializing":
    case "renderer_warmup":
    case "rendering":
    case "encoding":
    case "uploading":
    case "finalizing":
      return value;
    case null:
    case undefined:
      return null;
    default:
      return null;
  }
}

function parseJobSnapshot(payload: unknown, exportJobId: string): RenderWorkerJobSnapshot {
  if (typeof payload !== "object" || payload === null) {
    throw new NonRetryableWorkerError(
      `Export job payload for ${exportJobId} is not an object.`,
      {
        code: "INVALID_EXPORT_JOB_STATUS",
      },
    );
  }

  const candidate = payload as {
    job?: {
      id?: unknown;
      status?: unknown;
      progress?: unknown;
    };
    execution?: {
      stage?: unknown;
      progressPct?: unknown;
    };
  };

  if (!candidate.job || candidate.job.id !== exportJobId) {
    throw new NonRetryableWorkerError(
      `Export job payload for ${exportJobId} is missing job metadata.`,
      {
        code: "INVALID_EXPORT_JOB_STATUS",
      },
    );
  }

  const status = toJobStatus(candidate.job.status);

  if (!status) {
    throw new NonRetryableWorkerError(
      `Export job payload for ${exportJobId} has an invalid status.`,
      {
        code: "INVALID_EXPORT_JOB_STATUS",
      },
    );
  }

  const progressPct =
    typeof candidate.execution?.progressPct === "number"
      ? candidate.execution.progressPct
      : typeof candidate.job.progress === "number"
        ? candidate.job.progress
        : null;

  return {
    exportJobId,
    status,
    progressPct,
    stage: toStage(candidate.execution?.stage),
  };
}

export function createRenderWorkerSessionClient(input: {
  baseUrl: string;
  internalToken: string;
}): RenderWorkerSessionClient {
  function resolveUrl(routePath: string): string {
    return new URL(routePath, input.baseUrl).toString();
  }

  function buildHeaders(internal = true): HeadersInit {
    return {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "spectral-render-worker/1.0",
      ...(internal
        ? {
            authorization: `Bearer ${input.internalToken}`,
          }
        : {}),
    };
  }

  async function request(routePath: string, init: RequestInit, stage: ExportJobStage | null) {
    const url = resolveUrl(routePath);

    let response: Response;

    try {
      response = await fetch(url, init);
    } catch (error) {
      throw new RetryableWorkerError(
        `Failed to reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "CONTROL_PLANE_UNREACHABLE",
          stage,
          details: {
            url,
            method: init.method ?? "GET",
          },
          cause: error,
        },
      );
    }

    if (!response.ok) {
      const body = await readResponseText(response);
      const ErrorCtor = isRetryableStatus(response.status)
        ? RetryableWorkerError
        : NonRetryableWorkerError;

      throw new ErrorCtor(
        `${init.method ?? "GET"} ${url} responded with ${response.status}${body ? `: ${body}` : "."}`,
        {
          code: isRetryableStatus(response.status)
            ? "CONTROL_PLANE_RETRYABLE_STATUS"
            : "CONTROL_PLANE_BAD_STATUS",
          stage,
          details: {
            url,
            method: init.method ?? "GET",
            status: response.status,
          },
        },
      );
    }

    return response;
  }

  async function readJson(routePath: string, internal: boolean, stage: ExportJobStage | null) {
    const response = await request(
      routePath,
      {
        method: "GET",
        headers: buildHeaders(internal),
      },
      stage,
    );

    try {
      return await response.json();
    } catch (error) {
      throw new NonRetryableWorkerError(
        `GET ${resolveUrl(routePath)} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "CONTROL_PLANE_INVALID_JSON",
          stage,
          cause: error,
        },
      );
    }
  }

  async function postJson(
    routePath: string,
    body: unknown,
    stage: ExportJobStage | null,
  ): Promise<void> {
    await request(
      routePath,
      {
        method: "POST",
        headers: buildHeaders(true),
        body: JSON.stringify(body),
      },
      stage,
    );
  }

  return {
    resolveUrl,

    async fetchSession(exportJobId: string) {
      const payload = await readJson(
        `/api/internal/exports/${exportJobId}/session`,
        true,
        "session_ready",
      );

      try {
        return renderSessionSchema.parse(payload);
      } catch (error) {
        throw new NonRetryableWorkerError(
          `Export session payload for ${exportJobId} is invalid.`,
          {
            code: "INVALID_RENDER_SESSION",
            stage: "session_ready",
            cause: error,
          },
        );
      }
    },

    async getJobSnapshot(session: RenderSession) {
      const payload = await readJson(session.routes.public.statusPath, false, null);
      return parseJobSnapshot(payload, session.exportJobId);
    },

    async reportHeartbeat(session: RenderSession, payload: WorkerHeartbeatPayload) {
      await postJson(session.routes.internal.heartbeatPath, payload, payload.stage ?? null);
    },

    async updateStage(session: RenderSession, payload: ExportJobStageUpdatePayload) {
      await postJson(session.routes.internal.stagePath, payload, payload.stage);
    },

    async createArtifact(session: RenderSession, payload: ExportArtifactCreatedPayload) {
      await postJson(session.routes.internal.artifactsPath, payload, null);
    },

    async finalize(session: RenderSession, payload: ExportJobFinalizePayload) {
      await postJson(session.routes.internal.finalizePath, payload, "finalizing");
    },
  };
}
