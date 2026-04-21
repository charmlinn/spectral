export type AppErrorOptions = {
  code: string;
  statusCode: number;
  details?: unknown;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message, {
      cause: options.cause,
    });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function notFound(message: string, details?: unknown): AppError {
  return new AppError(message, {
    code: "NOT_FOUND",
    statusCode: 404,
    details,
  });
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(message, {
    code: "BAD_REQUEST",
    statusCode: 400,
    details,
  });
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(message, {
    code: "CONFLICT",
    statusCode: 409,
    details,
  });
}

export function serviceUnavailable(message: string, details?: unknown): AppError {
  return new AppError(message, {
    code: "SERVICE_UNAVAILABLE",
    statusCode: 503,
    details,
  });
}
