import type {
  AssetRepository,
  CompleteMediaAssetInput,
  CreateMediaAssetInput,
  JsonRecord,
  MediaAssetRecord,
} from "../contracts";
import type { DbClient } from "./shared";
import { mapMediaAssetRecord, toPrismaJsonRecord } from "./shared";

export function createAssetRepository(db: DbClient): AssetRepository {
  return {
    async createPendingAsset(input: CreateMediaAssetInput): Promise<MediaAssetRecord> {
      const asset = await db.mediaAsset.create({
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
          metadata: toPrismaJsonRecord(input.metadata),
        },
      });

      return mapMediaAssetRecord(asset);
    },

    async completeAsset(
      assetId: string,
      input: CompleteMediaAssetInput,
    ): Promise<MediaAssetRecord> {
      const asset = await db.mediaAsset.update({
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
          metadata:
            input.metadata === undefined ? undefined : toPrismaJsonRecord(input.metadata),
          completedAt: new Date(),
        },
      });

      return mapMediaAssetRecord(asset);
    },

    async failAsset(assetId: string, metadata: JsonRecord = {}): Promise<MediaAssetRecord> {
      const asset = await db.mediaAsset.update({
        where: {
          id: assetId,
        },
        data: {
          status: "failed",
          metadata: toPrismaJsonRecord(metadata),
        },
      });

      return mapMediaAssetRecord(asset);
    },

    async getAssetById(assetId: string): Promise<MediaAssetRecord | null> {
      const asset = await db.mediaAsset.findUnique({
        where: {
          id: assetId,
        },
      });

      return asset ? mapMediaAssetRecord(asset) : null;
    },

    async getAssetByStorageKey(storageKey: string): Promise<MediaAssetRecord | null> {
      const asset = await db.mediaAsset.findUnique({
        where: {
          storageKey,
        },
      });

      return asset ? mapMediaAssetRecord(asset) : null;
    },

    async findAssetBySha256(sha256: string): Promise<MediaAssetRecord | null> {
      const asset = await db.mediaAsset.findFirst({
        where: {
          sha256,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return asset ? mapMediaAssetRecord(asset) : null;
    },
  };
}
