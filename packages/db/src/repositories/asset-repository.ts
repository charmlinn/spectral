import type { DbClient, JsonRecord } from "./shared";

export type CreateMediaAssetInput = {
  id?: string;
  projectId?: string | null;
  kind: string;
  storageKey: string;
  bucket?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sha256?: string | null;
  byteSize?: bigint | number | null;
  metadata?: JsonRecord;
};

export function createAssetRepository(db: DbClient) {
  return {
    async createPendingAsset(input: CreateMediaAssetInput) {
      return db.mediaAsset.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          projectId: input.projectId ?? null,
          kind: input.kind,
          status: "pending",
          storageKey: input.storageKey,
          bucket: input.bucket ?? null,
          originalFilename: input.originalFilename ?? null,
          mimeType: input.mimeType ?? null,
          sha256: input.sha256 ?? null,
          byteSize:
            input.byteSize === null || input.byteSize === undefined
              ? null
              : BigInt(input.byteSize),
          metadata: input.metadata ?? {},
        },
      });
    },

    async completeAsset(
      assetId: string,
      input: {
        sha256?: string | null;
        byteSize?: bigint | number | null;
        width?: number | null;
        height?: number | null;
        durationMs?: number | null;
        sampleRate?: number | null;
        channels?: number | null;
        metadata?: JsonRecord;
      },
    ) {
      return db.mediaAsset.update({
        where: {
          id: assetId,
        },
        data: {
          status: "ready",
          sha256: input.sha256 ?? undefined,
          byteSize:
            input.byteSize === null || input.byteSize === undefined
              ? undefined
              : BigInt(input.byteSize),
          width: input.width ?? undefined,
          height: input.height ?? undefined,
          durationMs: input.durationMs ?? undefined,
          sampleRate: input.sampleRate ?? undefined,
          channels: input.channels ?? undefined,
          metadata: input.metadata ?? undefined,
          completedAt: new Date(),
        },
      });
    },

    async failAsset(assetId: string, metadata: JsonRecord = {}) {
      return db.mediaAsset.update({
        where: {
          id: assetId,
        },
        data: {
          status: "failed",
          metadata,
        },
      });
    },

    async getAssetById(assetId: string) {
      return db.mediaAsset.findUnique({
        where: {
          id: assetId,
        },
      });
    },

    async findAssetBySha256(sha256: string) {
      return db.mediaAsset.findFirst({
        where: {
          sha256,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },
  };
}
