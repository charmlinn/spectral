import { createAssetUploadSignature, inferExtensionFromFilename, buildProjectAssetStorageKey } from "@spectral/media";

import { notFound } from "../errors";
import { getStorageAdapter } from "../media";
import { getServerRepositories } from "../repositories";

export async function createAssetUploadUrl(input: {
  projectId: string;
  kind: "audio" | "image" | "video" | "logo" | "font" | "thumbnail" | "analysis" | "other";
  contentType: string;
  originalFilename: string;
}) {
  const { assetRepository, projectRepository } = getServerRepositories();

  const project = await projectRepository.getProjectById(input.projectId);

  if (!project) {
    throw notFound("Project not found.", {
      projectId: input.projectId,
    });
  }

  const assetId = crypto.randomUUID();
  const storageKey = buildProjectAssetStorageKey({
    projectId: input.projectId,
    assetId,
    extension: inferExtensionFromFilename(input.originalFilename),
  });

  const pendingAsset = await assetRepository.createPendingAsset({
    id: assetId,
    projectId: input.projectId,
    kind: input.kind,
    originalFilename: input.originalFilename,
    mimeType: input.contentType,
    storageKey,
    metadata: {
      uploadStatus: "signing",
    },
  });

  const signedUpload = await createAssetUploadSignature(getStorageAdapter(), {
    projectId: input.projectId,
    assetId: pendingAsset.id,
    storageKey,
    contentType: input.contentType,
    originalFilename: input.originalFilename,
  });

  return {
    asset: pendingAsset,
    upload: signedUpload,
  };
}

export async function completeAsset(input: {
  assetId: string;
  sha256?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const { assetRepository } = getServerRepositories();
  const asset = await assetRepository.getAssetById(input.assetId);

  if (!asset) {
    throw notFound("Asset not found.", {
      assetId: input.assetId,
    });
  }

  return assetRepository.completeAsset(input.assetId, input);
}

export async function getAsset(assetId: string) {
  const { assetRepository } = getServerRepositories();
  const asset = await assetRepository.getAssetById(assetId);

  if (!asset) {
    throw notFound("Asset not found.", {
      assetId,
    });
  }

  const resolvedUrl =
    asset.status === "ready"
      ? await getStorageAdapter().createSignedReadUrl({
          key: asset.storageKey,
        })
      : null;

  return {
    ...asset,
    resolvedUrl,
  };
}
