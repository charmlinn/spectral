import {
  exportJobStageUpdatePayloadSchema,
  renderSessionSchema,
  workerHeartbeatPayloadSchema,
  type ExportJobStage,
  type RenderSession,
  type WorkerHeartbeatPayload,
} from "@spectral/render-session";

import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";

export type RenderExecutionInput = {
  exportJobId: string;
  renderPageUrl: string;
  renderSessionUrl: string;
  internalToken?: string | null;
  workerId: string;
  attempt: number;
  framesRootDir?: string | null;
};

export type RenderExecutionResult = {
  outputStorageKey?: string | null;
  posterStorageKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type RenderExecutor = {
  execute(input: RenderExecutionInput): Promise<RenderExecutionResult>;
};

function buildHeaders(
  internalToken?: string | null,
  contentType?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "spectral-render-worker/1.0",
  };

  if (contentType) {
    headers["content-type"] = contentType;
  }

  if (internalToken) {
    headers.authorization = `Bearer ${internalToken}`;
  }

  return headers;
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function resolveInternalUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

export async function fetchRenderSession(
  url: string,
  exportJobId: string,
  internalToken?: string | null,
): Promise<RenderSession> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: buildHeaders(internalToken),
    });
  } catch (error) {
    throw new RetryableWorkerError(
      `Failed to reach render session ${url}: ${error instanceof Error ? error.message : String(error)}`,
      "RENDER_SESSION_UNREACHABLE",
    );
  }

  if (!response.ok) {
    throw new RetryableWorkerError(
      `Render session ${url} responded with ${response.status}.`,
      "RENDER_SESSION_BAD_STATUS",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new NonRetryableWorkerError(
      `Render session ${url} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_RENDER_SESSION",
    );
  }

  const session = renderSessionSchema.safeParse(payload);

  if (!session.success || session.data.exportJobId !== exportJobId) {
    throw new NonRetryableWorkerError(
      `Render session payload for ${exportJobId} is missing required fields.`,
      "INVALID_RENDER_SESSION",
    );
  }

  return session.data;
}

async function postInternalMutation(
  url: string,
  payload: Record<string, unknown>,
  internalToken?: string | null,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(internalToken, "application/json"),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new RetryableWorkerError(
      `Failed to reach internal render API ${url}: ${error instanceof Error ? error.message : String(error)}`,
      "INTERNAL_RENDER_API_UNREACHABLE",
    );
  }

  if (!response.ok) {
    const responseText = await readResponseText(response);
    throw new RetryableWorkerError(
      `Internal render API ${url} responded with ${response.status}${responseText ? `: ${responseText}` : "."}`,
      "INTERNAL_RENDER_API_BAD_STATUS",
    );
  }
}

export async function postRenderStage(input: {
  session: RenderSession;
  webBaseUrl: string;
  internalToken?: string | null;
  workerId: string;
  attempt: number;
  stage: ExportJobStage;
  progressPct?: number | null;
  message?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const payload = exportJobStageUpdatePayloadSchema.parse({
    workerId: input.workerId,
    attempt: input.attempt,
    stage: input.stage,
    progressPct: input.progressPct,
    message: input.message,
    details: input.details,
  });

  await postInternalMutation(
    resolveInternalUrl(input.session.routes.internal.stagePath, input.webBaseUrl),
    payload,
    input.internalToken,
  );
}

export async function postRenderHeartbeat(input: {
  session: RenderSession;
  webBaseUrl: string;
  internalToken?: string | null;
  workerId: string;
  attempt: number;
  stage?: ExportJobStage | null;
  progressPct?: number | null;
  message?: string | null;
  details?: WorkerHeartbeatPayload["details"];
}): Promise<void> {
  const payload = workerHeartbeatPayloadSchema.parse({
    workerId: input.workerId,
    attempt: input.attempt,
    heartbeatAt: new Date().toISOString(),
    stage: input.stage,
    progressPct: input.progressPct,
    message: input.message,
    details: input.details,
  });

  await postInternalMutation(
    resolveInternalUrl(input.session.routes.internal.heartbeatPath, input.webBaseUrl),
    payload,
    input.internalToken,
  );
}
