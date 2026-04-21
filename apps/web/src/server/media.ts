import { R2AssetResolver, R2StorageAdapter } from "@spectral/media";

import { getServerEnv } from "./env";
import { getServerRepositories } from "./repositories";

let cachedStorageAdapter: R2StorageAdapter | null = null;
let cachedAssetResolver: R2AssetResolver | null = null;

export function getStorageAdapter() {
  if (cachedStorageAdapter) {
    return cachedStorageAdapter;
  }

  const env = getServerEnv();

  cachedStorageAdapter = new R2StorageAdapter({
    accountId: env.r2AccountId,
    bucket: env.r2Bucket,
    region: env.r2Region,
    endpoint: env.r2Endpoint,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    publicBaseUrl: env.r2PublicBaseUrl,
  });

  return cachedStorageAdapter;
}

export function getAssetResolver() {
  if (cachedAssetResolver) {
    return cachedAssetResolver;
  }

  const { prisma } = getServerRepositories();

  cachedAssetResolver = new R2AssetResolver({
    adapter: getStorageAdapter(),
    lookup: {
      async getAssetById(assetId: string) {
        const asset = await prisma.mediaAsset.findUnique({
          where: {
            id: assetId,
          },
        });

        if (!asset) {
          return null;
        }

        return {
          id: asset.id,
          storageKey: asset.storageKey,
          mimeType: asset.mimeType,
        };
      },
      async getArtifactById(artifactId: string) {
        const artifact = await prisma.renderArtifact.findUnique({
          where: {
            id: artifactId,
          },
        });

        if (!artifact) {
          return null;
        }

        return {
          id: artifact.id,
          storageKey: artifact.storageKey,
          mimeType: artifact.mimeType,
        };
      },
      async getFontById(fontId: string) {
        const font = await prisma.mediaAsset.findUnique({
          where: {
            id: fontId,
          },
        });

        if (!font) {
          return null;
        }

        return {
          id: font.id,
          storageKey: font.storageKey,
          mimeType: font.mimeType,
        };
      },
    },
  });

  return cachedAssetResolver;
}
