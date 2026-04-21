import type { CreateSignedUploadInput, ProjectAssetUploadPlan, SignedUpload, StorageAdapter } from "./contracts";
import { buildProjectAssetStorageKey, inferExtensionFromFilename } from "./keys";

export type CreateAssetUploadSignatureInput = {
  projectId: string;
  assetId: string;
  storageKey: string;
  contentType: string;
  originalFilename: string;
  expiresInSeconds?: number;
};

export async function createAssetUploadSignature(
  adapter: StorageAdapter,
  input: CreateAssetUploadSignatureInput,
): Promise<SignedUpload> {
  const request: CreateSignedUploadInput = {
    key: input.storageKey,
    contentType: input.contentType,
    expiresInSeconds: input.expiresInSeconds,
    metadata: {
      projectId: input.projectId,
      assetId: input.assetId,
      originalFilename: input.originalFilename,
    },
  };

  return adapter.createSignedUpload(request);
}

export type CreateProjectAssetUploadPlanInput = {
  projectId: string;
  assetId: string;
  originalFilename: string;
  contentType: string;
  expiresInSeconds?: number;
};

export async function createProjectAssetUploadPlan(
  adapter: StorageAdapter,
  input: CreateProjectAssetUploadPlanInput,
): Promise<ProjectAssetUploadPlan> {
  const storageKey = buildProjectAssetStorageKey({
    projectId: input.projectId,
    assetId: input.assetId,
    extension: inferExtensionFromFilename(input.originalFilename),
  });
  const upload = await createAssetUploadSignature(adapter, {
    projectId: input.projectId,
    assetId: input.assetId,
    storageKey,
    contentType: input.contentType,
    originalFilename: input.originalFilename,
    expiresInSeconds: input.expiresInSeconds,
  });

  return {
    assetId: input.assetId,
    storageKey,
    upload,
  };
}
