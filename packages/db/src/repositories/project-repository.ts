import {
  VIDEO_PROJECT_SCHEMA_VERSION,
  migrateVideoProjectDocument,
  type VideoProject,
} from "@spectral/project-schema";

import type {
  CreateProjectInput,
  ProjectDetailRecord,
  ProjectRecord,
  ProjectRepository,
  ProjectSnapshotRecord,
  SaveProjectSnapshotInput,
  UpdateProjectMetadataInput,
} from "../contracts";
import type { DbClient } from "./shared";
import {
  mapProjectRecord,
  mapProjectSnapshotRecord,
  toPrismaJsonRecord,
  toPrismaJsonValue,
} from "./shared";

async function loadProjectDetail(
  db: DbClient,
  projectId: string,
): Promise<ProjectDetailRecord | null> {
  const project = await db.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    return null;
  }

  const projectRecord = mapProjectRecord(project);
  const activeSnapshot = project.activeSnapshotId
    ? await db.projectSnapshot.findUnique({
        where: {
          id: project.activeSnapshotId,
        },
      })
    : null;
  const activeSnapshotRecord = activeSnapshot ? mapProjectSnapshotRecord(activeSnapshot) : null;

  return {
    project: projectRecord,
    activeSnapshot: activeSnapshotRecord,
    activeProject: activeSnapshotRecord?.projectData ?? null,
  };
}

async function saveSnapshotWithDb(
  db: DbClient,
  input: SaveProjectSnapshotInput,
): Promise<ProjectSnapshotRecord> {
  const current = await db.projectSnapshot.findFirst({
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
  const snapshot = await db.projectSnapshot.create({
    data: {
      projectId: input.projectId,
      schemaVersion: input.schemaVersion ?? VIDEO_PROJECT_SCHEMA_VERSION,
      snapshotIndex: (current?.snapshotIndex ?? 0) + 1,
      source: input.source ?? "editor",
      reason: input.reason ?? null,
      projectData: toPrismaJsonValue(migrateVideoProjectDocument(input.projectData)),
    },
  });

  await db.project.update({
    where: {
      id: input.projectId,
    },
    data: {
      activeSnapshotId: snapshot.id,
    },
  });

  return mapProjectSnapshotRecord(snapshot);
}

export function createProjectRepository(db: DbClient): ProjectRepository {
  return {
    async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
      const project = await db.project.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          description: input.description ?? null,
          presetId: input.presetId ?? null,
          metadata: toPrismaJsonRecord(input.metadata),
        },
      });

      return mapProjectRecord(project);
    },

    async listProjects(): Promise<ProjectDetailRecord[]> {
      const projects = await db.project.findMany({
        where: {
          archivedAt: null,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 50,
      });
      const snapshotIds = projects
        .map((project) => project.activeSnapshotId)
        .filter((snapshotId): snapshotId is string => Boolean(snapshotId));
      const snapshots =
        snapshotIds.length > 0
          ? await db.projectSnapshot.findMany({
              where: {
                id: {
                  in: snapshotIds,
                },
              },
            })
          : [];
      const snapshotsById = new Map(
        snapshots.map((snapshot) => [snapshot.id, mapProjectSnapshotRecord(snapshot)]),
      );

      return projects.map((project) => {
        const projectRecord = mapProjectRecord(project);
        const activeSnapshot = project.activeSnapshotId
          ? (snapshotsById.get(project.activeSnapshotId) ?? null)
          : null;

        return {
          project: projectRecord,
          activeSnapshot,
          activeProject: activeSnapshot?.projectData ?? null,
        };
      });
    },

    async getProjectById(projectId: string): Promise<ProjectDetailRecord | null> {
      return loadProjectDetail(db, projectId);
    },

    async updateProjectMetadata(
      projectId: string,
      input: UpdateProjectMetadataInput,
    ): Promise<ProjectRecord> {
      const project = await db.project.update({
        where: {
          id: projectId,
        },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.metadata !== undefined
            ? { metadata: toPrismaJsonRecord(input.metadata) }
            : {}),
          ...(input.presetId !== undefined ? { presetId: input.presetId } : {}),
        },
      });

      return mapProjectRecord(project);
    },

    async listSnapshots(projectId: string): Promise<ProjectSnapshotRecord[]> {
      const snapshots = await db.projectSnapshot.findMany({
        where: {
          projectId,
        },
        orderBy: {
          snapshotIndex: "desc",
        },
      });

      return snapshots.map(mapProjectSnapshotRecord);
    },

    async getSnapshotById(snapshotId: string): Promise<ProjectSnapshotRecord | null> {
      const snapshot = await db.projectSnapshot.findUnique({
        where: {
          id: snapshotId,
        },
      });

      return snapshot ? mapProjectSnapshotRecord(snapshot) : null;
    },

    async saveSnapshot(input: SaveProjectSnapshotInput): Promise<ProjectSnapshotRecord> {
      if ("$transaction" in db && typeof db.$transaction === "function") {
        return db.$transaction((tx: DbClient) => saveSnapshotWithDb(tx, input));
      }

      return saveSnapshotWithDb(db, input);
    },

    async getProjectWithActiveSnapshot(projectId: string): Promise<ProjectDetailRecord | null> {
      return loadProjectDetail(db, projectId);
    },

    async getActiveProjectDocument(projectId: string): Promise<VideoProject | null> {
      const detail = await loadProjectDetail(db, projectId);
      return detail?.activeProject ?? null;
    },
  };
}
