import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client/client";

const globalCache = globalThis as typeof globalThis & {
  __spectralPrismaClient?: PrismaClient;
};

export type DatabaseUrlInput = {
  connectionString?: string;
};

export type InternalPrismaClient = PrismaClient;

export function getDatabaseUrl(input: DatabaseUrlInput = {}): string {
  const connectionString = input.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a Prisma client.");
  }

  return connectionString;
}

export function createPrismaClient(input: DatabaseUrlInput = {}): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(input),
  });

  return new PrismaClient({
    adapter,
  });
}

export function getPrismaClient(input: DatabaseUrlInput = {}): PrismaClient {
  if (!globalCache.__spectralPrismaClient) {
    globalCache.__spectralPrismaClient = createPrismaClient(input);
  }

  return globalCache.__spectralPrismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (globalCache.__spectralPrismaClient) {
    await globalCache.__spectralPrismaClient.$disconnect();
    delete globalCache.__spectralPrismaClient;
  }
}
