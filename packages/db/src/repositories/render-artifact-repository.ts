import type { DbClient, JsonRecord } from "./shared";

export type CreateRenderArtifactInput = {
  id?: string;
  projectId?: string | null;
  exportJobId?: string | null;
  kind: string;
  storageKey: string;
  mimeType?: string | null;
  byteSize?: bigint | number | null;
  metadata?: JsonRecord;
};

export function createRenderArtifactRepository(db: DbClient) {
  return {
    async createArtifact(input: CreateRenderArtifactInput) {
      return db.renderArtifact.create({
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
          metadata: input.metadata ?? {},
        },
      });
    },
  };
}
