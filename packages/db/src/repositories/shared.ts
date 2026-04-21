import type { Prisma, PrismaClient } from "../generated/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type JsonRecord = Record<string, unknown>;

export function toJsonRecord(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}
