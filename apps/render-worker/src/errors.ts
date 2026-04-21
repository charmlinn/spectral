export class RetryableWorkerError extends Error {
  readonly code: string;

  constructor(message: string, code = "RETRYABLE_WORKER_ERROR") {
    super(message);
    this.name = "RetryableWorkerError";
    this.code = code;
  }
}

export class NonRetryableWorkerError extends Error {
  readonly code: string;

  constructor(message: string, code = "NON_RETRYABLE_WORKER_ERROR") {
    super(message);
    this.name = "NonRetryableWorkerError";
    this.code = code;
  }
}
