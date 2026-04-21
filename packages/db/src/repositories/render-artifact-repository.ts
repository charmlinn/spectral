import type {
  CreateRenderArtifactInput,
  RenderArtifactRecord,
  RenderArtifactRepository,
} from "../contracts";
import type { DbClient } from "./shared";
import { mapRenderArtifactRecord, toPrismaJsonRecord } from "./shared";

export function createRenderArtifactRepository(db: DbClient): RenderArtifactRepository {
  return {
    async createArtifact(input: CreateRenderArtifactInput): Promise<RenderArtifactRecord> {
      const artifact = await db.renderArtifact.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          projectId: input.projectId ?? null,
          exportJobId: input.exportJobId ?? null,
          kind: input.kind,
          storageKey: input.storageKey,
          mimeType: input.mimeType ?? null,
          byteSize:
            input.byteSize === null || input.byteSize === undefined
              ? null
              : BigInt(input.byteSize),
          metadata: toPrismaJsonRecord(input.metadata),
        },
      });

      return mapRenderArtifactRecord(artifact);
    },

    async getArtifactById(artifactId: string): Promise<RenderArtifactRecord | null> {
      const artifact = await db.renderArtifact.findUnique({
        where: {
          id: artifactId,
        },
      });

      return artifact ? mapRenderArtifactRecord(artifact) : null;
    },

    async getArtifactByStorageKey(storageKey: string): Promise<RenderArtifactRecord | null> {
      const artifact = await db.renderArtifact.findUnique({
        where: {
          storageKey,
        },
      });

      return artifact ? mapRenderArtifactRecord(artifact) : null;
    },

    async listArtifactsByExportJobId(exportJobId: string): Promise<RenderArtifactRecord[]> {
      const artifacts = await db.renderArtifact.findMany({
        where: {
          exportJobId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return artifacts.map(mapRenderArtifactRecord);
    },
  };
}
