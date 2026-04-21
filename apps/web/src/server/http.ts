import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, isAppError } from "./errors";

type JsonBodyOptions = {
  status?: number;
};

export function serializeForJson<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item)) as T;
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeForJson(nestedValue)]),
    ) as T;
  }

  return value;
}

export function jsonResponse(payload: unknown, options: JsonBodyOptions = {}) {
  return NextResponse.json(serializeForJson(payload), {
    status: options.status ?? 200,
  });
}

function normalizeError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      payload: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          issues: error.issues,
        },
      },
    };
  }

  if (isAppError(error)) {
    return {
      status: error.statusCode,
      payload: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unknown server error.";

  return {
    status: 500,
    payload: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message,
      },
    },
  };
}

export function handleRouteError(error: unknown) {
  const normalized = normalizeError(error);

  if (
    !(error instanceof ZodError) &&
    !(error instanceof AppError) &&
    error instanceof Error
  ) {
    console.error(error);
  }

  return jsonResponse(normalized.payload, {
    status: normalized.status,
  });
}
