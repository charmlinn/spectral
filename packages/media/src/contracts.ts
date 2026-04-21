export type StorageObjectDescriptor = {
  id: string;
  storageKey: string;
  mimeType?: string | null;
};

export type AssetResolver = {
  resolveImage(assetId: string): Promise<string>;
  resolveVideo(assetId: string): Promise<string>;
  resolveAudio(assetId: string): Promise<string>;
  resolveFont(fontId: string): Promise<string | null>;
  resolveArtifact(objectId: string): Promise<string>;
};

export type AssetLookup = {
  getAssetById(assetId: string): Promise<StorageObjectDescriptor | null>;
  getArtifactById?(artifactId: string): Promise<StorageObjectDescriptor | null>;
  getFontById?(fontId: string): Promise<StorageObjectDescriptor | null>;
};

export type CreateSignedUploadInput = {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
  metadata?: Record<string, string>;
};

export type SignedUpload = {
  key: string;
  bucket: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export type SignedReadInput = {
  key: string;
  expiresInSeconds?: number;
};

export type StorageAdapter = {
  bucket: string;
  createSignedUpload(input: CreateSignedUploadInput): Promise<SignedUpload>;
  createSignedReadUrl(input: SignedReadInput): Promise<string>;
  putJson(key: string, payload: unknown, contentType?: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{
    contentLength?: number;
    contentType?: string;
    etag?: string;
    lastModified?: Date;
  } | null>;
  resolvePublicUrl(key: string): string | null;
};
