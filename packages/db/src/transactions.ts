import type { PrismaClient } from "./generated/client";
import type { DbClient } from "./repositories/shared";

export async function withTransaction<T>(
  db: PrismaClient,
  fn: (tx: DbClient) => Promise<T>,
): Promise<T> {
  return db.$transaction((tx) => fn(tx)) as Promise<T>;
}
