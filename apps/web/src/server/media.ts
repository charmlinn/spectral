import {
  createR2StorageAdapterFromEnv,
  createRepositoryAssetLookup,
  R2AssetResolver,
  type AssetResolver,
} from "@spectral/media";
import type { MediaAssetRecord } from "@spectral/db";

import { getServerEnv } from "./env";
import { getServerRepositories } from "./repositories";

let cachedStorageAdapter: ReturnType<typeof createR2StorageAdapterFromEnv> | null = null;
let cachedAssetResolver: R2AssetResolver | null = null;

export function getStorageAdapter() {
  if (cachedStorageAdapter) {
    return cachedStorageAdapter;
  }

  const env = getServerEnv();

  cachedStorageAdapter = createR2StorageAdapterFromEnv({
    R2_ACCOUNT_ID: env.r2AccountId,
    R2_BUCKET: env.r2Bucket,
    R2_REGION: env.r2Region,
    R2_ENDPOINT: env.r2Endpoint,
    R2_ACCESS_KEY_ID: env.r2AccessKeyId,
    R2_SECRET_ACCESS_KEY: env.r2SecretAccessKey,
    R2_PUBLIC_BASE_URL: env.r2PublicBaseUrl,
    R2_FORCE_PATH_STYLE: env.r2ForcePathStyle ? "true" : "false",
  });

  return cachedStorageAdapter;
}

export function getAssetResolver() {
  if (cachedAssetResolver) {
    return cachedAssetResolver;
  }

  const repositories = getServerRepositories();

  cachedAssetResolver = new R2AssetResolver({
    adapter: getStorageAdapter(),
    lookup: createRepositoryAssetLookup({
      assetRepository: repositories.assetRepository,
      renderArtifactRepository: repositories.renderArtifactRepository,
    }),
  });

  return cachedAssetResolver;
}

export async function resolveAssetRecordUrl(
  asset: Pick<MediaAssetRecord, "id" | "kind">,
  resolver: AssetResolver = getAssetResolver(),
): Promise<string> {
  if (asset.kind === "audio") {
    return resolver.resolveAudio(asset.id);
  }

  if (asset.kind === "video") {
    return resolver.resolveVideo(asset.id);
  }

  if (asset.kind === "font") {
    const url = await resolver.resolveFont(asset.id);

    if (!url) {
      throw new Error(`Font asset could not be resolved: ${asset.id}`);
    }

    return url;
  }

  return resolver.resolveImage(asset.id);
}
