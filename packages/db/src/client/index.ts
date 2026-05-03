import type { SpectralDataLayer, SpectralRepositories } from "../contracts";
import type { DbClient } from "../repositories/index";
import { createRepositories } from "../repositories/index";
import type { DatabaseUrlInput } from "./prisma-client";
import {
  createPrismaClient,
  disconnectPrismaClient,
  getPrismaClient,
} from "./prisma-client";

const globalCache = globalThis as typeof globalThis & {
  __spectralDataLayer?: SpectralDataLayer;
};

function buildDataLayer(
  repositories: SpectralRepositories,
  disconnect: () => Promise<void>,
  transaction: SpectralDataLayer["transaction"],
): SpectralDataLayer {
  return {
    ...repositories,
    disconnect,
    transaction,
  };
}

function isCurrentDataLayer(dataLayer: SpectralDataLayer | undefined): dataLayer is SpectralDataLayer {
  return typeof dataLayer?.projectRepository.listProjects === "function";
}

export function createDataLayer(input: DatabaseUrlInput = {}): SpectralDataLayer {
  const prisma = createPrismaClient(input);
  const repositories = createRepositories(prisma);

  return buildDataLayer(repositories, () => prisma.$disconnect(), (fn) =>
    prisma.$transaction((tx: DbClient) => fn(createRepositories(tx))) as Promise<
      Awaited<ReturnType<typeof fn>>
    >,
  );
}

export function getDataLayer(input: DatabaseUrlInput = {}): SpectralDataLayer {
  if (!isCurrentDataLayer(globalCache.__spectralDataLayer)) {
    const prisma = getPrismaClient(input);
    const repositories = createRepositories(prisma);
    globalCache.__spectralDataLayer = buildDataLayer(repositories, disconnectPrismaClient, (fn) =>
      prisma.$transaction((tx: DbClient) => fn(createRepositories(tx))) as Promise<
        Awaited<ReturnType<typeof fn>>
      >,
    );
  }

  return globalCache.__spectralDataLayer;
}

export async function disconnectDataLayer(): Promise<void> {
  await disconnectPrismaClient();
  delete globalCache.__spectralDataLayer;
}

export type { DatabaseUrlInput } from "./prisma-client";
