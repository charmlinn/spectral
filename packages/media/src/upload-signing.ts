import type { CreateSignedUploadInput, SignedUpload, StorageAdapter } from "./contracts";

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
