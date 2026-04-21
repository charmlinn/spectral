import {
  VIDEO_PROJECT_SCHEMA_VERSION,
  migrateVideoProjectDocument,
  type VideoProject,
} from "@spectral/project-schema";

import type { DbClient, JsonRecord } from "./shared";
import { toJsonRecord } from "./shared";

export type CreateProjectInput = {
  id?: string;
  name: string;
  description?: string | null;
  presetId?: string | null;
  metadata?: JsonRecord;
};

export type SaveProjectSnapshotInput = {
  projectId: string;
  projectData: VideoProject | Record<string, unknown>;
  schemaVersion?: number;
  source?: string;
  reason?: string | null;
};

export function createProjectRepository(db: DbClient) {
  async function saveSnapshotWithDb(targetDb: DbClient, input: SaveProjectSnapshotInput) {
    const normalized = migrateVideoProjectDocument(input.projectData);
    const current = await targetDb.projectSnapshot.findFirst({
      where: {
        projectId: input.projectId,
      },
      orderBy: {
        snapshotIndex: "desc",
      },
      select: {
        snapshotIndex: true,
      },
    });
    const snapshot = await targetDb.projectSnapshot.create({
      data: {
        projectId: input.projectId,
        schemaVersion: input.schemaVersion ?? VIDEO_PROJECT_SCHEMA_VERSION,
        snapshotIndex: (current?.snapshotIndex ?? 0) + 1,
        source: input.source ?? "editor",
        reason: input.reason ?? null,
        projectData: normalized,
      },
    });

    await targetDb.project.update({
      where: {
        id: input.projectId,
      },
      data: {
        activeSnapshotId: snapshot.id,
      },
    });

    return snapshot;
  }

  return {
    async createProject(input: CreateProjectInput) {
      return db.project.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          description: input.description ?? null,
          presetId: input.presetId ?? null,
          metadata: input.metadata ?? {},
        },
      });
    },

    async getProjectById(projectId: string) {
      const project = await db.project.findUnique({
        where: {
          id: projectId,
        },
      });

      if (!project) {
        return null;
      }

      const activeSnapshot = project.activeSnapshotId
        ? await db.projectSnapshot.findUnique({
            where: {
              id: project.activeSnapshotId,
            },
          })
        : null;

      return {
        ...project,
        activeSnapshot,
      };
    },

    async updateProjectMetadata(
      projectId: string,
      input: {
        name?: string;
        description?: string | null;
        metadata?: JsonRecord;
        presetId?: string | null;
      },
    ) {
      return db.project.update({
        where: {
          id: projectId,
        },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          ...(input.presetId !== undefined ? { presetId: input.presetId } : {}),
        },
      });
    },

    async listSnapshots(projectId: string) {
      return db.projectSnapshot.findMany({
        where: {
          projectId,
        },
        orderBy: {
          snapshotIndex: "desc",
        },
      });
    },

    async saveSnapshot(input: SaveProjectSnapshotInput) {
      if ("$transaction" in db && typeof db.$transaction === "function") {
        return db.$transaction((tx) => saveSnapshotWithDb(tx, input));
      }

      return saveSnapshotWithDb(db, input);
    },

    async getProjectWithActiveSnapshot(projectId: string) {
      const project = await db.project.findUnique({
        where: {
          id: projectId,
        },
      });

      if (!project) {
        return null;
      }

      const activeSnapshot = project.activeSnapshotId
        ? await db.projectSnapshot.findUnique({
            where: {
              id: project.activeSnapshotId,
            },
          })
        : null;

      return {
        ...project,
        activeSnapshot,
        normalizedProject: activeSnapshot
          ? (migrateVideoProjectDocument(activeSnapshot.projectData) as VideoProject)
          : null,
        metadata: toJsonRecord(project.metadata),
      };
    },

    async getActiveProjectDocument(projectId: string): Promise<VideoProject | null> {
      const project = await db.project.findUnique({
        where: {
          id: projectId,
        },
      });

      if (!project?.activeSnapshotId) {
        return null;
      }

      const activeSnapshot = await db.projectSnapshot.findUnique({
        where: {
          id: project.activeSnapshotId,
        },
      });

      if (!activeSnapshot) {
        return null;
      }

      return migrateVideoProjectDocument(activeSnapshot.projectData);
    },
  };
}
