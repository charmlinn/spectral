import type { ExportJobStage } from "@spectral/render-session";

type WorkerErrorOptions = {
  code?: string;
  stage?: ExportJobStage | null;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export class WorkerExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly stage: ExportJobStage | null;
  readonly details: Record<string, unknown> | undefined;
  readonly cause: unknown;

  constructor(
    message: string,
    retryable: boolean,
    options: WorkerErrorOptions = {},
  ) {
    super(message);
    this.name = "WorkerExecutionError";
    this.code = options.code ?? "WORKER_EXECUTION_ERROR";
    this.retryable = retryable;
    this.stage = options.stage ?? null;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export class RetryableWorkerError extends WorkerExecutionError {
  constructor(message: string, options: WorkerErrorOptions = {}) {
    super(message, true, {
      ...options,
      code: options.code ?? "RETRYABLE_WORKER_ERROR",
    });
    this.name = "RetryableWorkerError";
  }
}

export class NonRetryableWorkerError extends WorkerExecutionError {
  constructor(message: string, options: WorkerErrorOptions = {}) {
    super(message, false, {
      ...options,
      code: options.code ?? "NON_RETRYABLE_WORKER_ERROR",
    });
    this.name = "NonRetryableWorkerError";
  }
}

export class WorkerCancelledError extends NonRetryableWorkerError {
  constructor(
    message: string,
    stage: ExportJobStage | null,
    details?: Record<string, unknown>,
  ) {
    super(message, {
      code: "EXPORT_CANCELLED",
      stage,
      details,
    });
    this.name = "WorkerCancelledError";
  }
}

export class WorkerJobTerminatedError extends NonRetryableWorkerError {
  constructor(
    message: string,
    stage: ExportJobStage | null,
    details?: Record<string, unknown>,
  ) {
    super(message, {
      code: "EXPORT_JOB_TERMINATED",
      stage,
      details,
    });
    this.name = "WorkerJobTerminatedError";
  }
}

export function isRetryableWorkerError(
  error: unknown,
): error is RetryableWorkerError {
  return (
    error instanceof RetryableWorkerError ||
    (error instanceof WorkerExecutionError && error.retryable)
  );
}

export function toWorkerError(
  error: unknown,
  fallback: {
    code?: string;
    stage?: ExportJobStage | null;
  } = {},
): WorkerExecutionError {
  if (error instanceof WorkerExecutionError) {
    return error;
  }

  if (error instanceof Error) {
    return new NonRetryableWorkerError(error.message, {
      code: fallback.code ?? "UNEXPECTED_WORKER_ERROR",
      stage: fallback.stage ?? null,
      cause: error,
    });
  }

  return new NonRetryableWorkerError(String(error), {
    code: fallback.code ?? "UNKNOWN_WORKER_ERROR",
    stage: fallback.stage ?? null,
  });
}
