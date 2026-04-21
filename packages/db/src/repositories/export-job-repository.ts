import type {
  AppendExportJobEventInput,
  CreateExportJobInput,
  ExportEventCursorInput,
  ExportJobDetailRecord,
  ExportJobEventRecord,
  ExportJobRecord,
  ExportJobRepository,
  UpdateExportJobStatusInput,
} from "../contracts";
import type { DbClient } from "./shared";
import { mapExportJobEventRecord, mapExportJobRecord, toPrismaJsonRecord } from "./shared";

function toTake(cursor?: ExportEventCursorInput): number {
  return cursor?.limit ?? 100;
}

function toJobEventWhere(jobId: string, cursor?: ExportEventCursorInput) {
  return {
    jobId,
    ...(cursor?.afterEventId !== undefined ? { id: { gt: cursor.afterEventId } } : {}),
  };
}

function toProjectEventWhere(projectId: string, cursor?: ExportEventCursorInput) {
  return {
    projectId,
    ...(cursor?.afterEventId !== undefined ? { id: { gt: cursor.afterEventId } } : {}),
  };
}

export function createExportJobRepository(db: DbClient): ExportJobRepository {
  return {
    async createQueuedJob(input: CreateExportJobInput): Promise<ExportJobRecord> {
      const job = await db.exportJob.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          projectId: input.projectId,
          snapshotId: input.snapshotId,
          status: "queued",
          format: input.format,
          width: input.width,
          height: input.height,
          fps: input.fps,
          durationMs: input.durationMs ?? null,
          metadata: toPrismaJsonRecord(input.metadata),
          queuedAt: new Date(),
        },
      });

      return mapExportJobRecord(job);
    },

    async appendEvent(
      jobId: string,
      input: AppendExportJobEventInput,
    ): Promise<ExportJobEventRecord> {
      const event = await db.exportJobEvent.create({
        data: {
          jobId,
          projectId: input.projectId ?? null,
          level: input.level ?? "info",
          type: input.type,
          message: input.message ?? null,
          progress: input.progress ?? null,
          payload: toPrismaJsonRecord(input.payload),
        },
      });

      return mapExportJobEventRecord(event);
    },

    async updateJobStatus(
      jobId: string,
      input: UpdateExportJobStatusInput,
    ): Promise<ExportJobRecord> {
      const now = new Date();
      const job = await db.exportJob.update({
        where: {
          id: jobId,
        },
        data: {
          status: input.status,
          progress: input.progress ?? undefined,
          outputStorageKey: input.outputStorageKey ?? undefined,
          posterStorageKey: input.posterStorageKey ?? undefined,
          errorCode: input.errorCode ?? undefined,
          errorMessage: input.errorMessage ?? undefined,
          attempts: input.attempts ?? undefined,
          metadata:
            input.metadata === undefined ? undefined : toPrismaJsonRecord(input.metadata),
          ...(input.status === "running" ? { startedAt: now } : {}),
          ...(input.status === "completed" ? { completedAt: now } : {}),
          ...(input.status === "failed" ? { failedAt: now } : {}),
          ...(input.status === "cancelled" ? { cancelledAt: now } : {}),
        },
      });

      return mapExportJobRecord(job);
    },

    async getJobById(jobId: string): Promise<ExportJobDetailRecord | null> {
      const job = await db.exportJob.findUnique({
        where: {
          id: jobId,
        },
      });

      if (!job) {
        return null;
      }

      const events = await db.exportJobEvent.findMany({
        where: {
          jobId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return {
        job: mapExportJobRecord(job),
        events: events.map(mapExportJobEventRecord),
      };
    },

    async listJobsByProjectId(projectId: string): Promise<ExportJobRecord[]> {
      const jobs = await db.exportJob.findMany({
        where: {
          projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return jobs.map(mapExportJobRecord);
    },

    async listEventsByJobId(
      jobId: string,
      cursor?: ExportEventCursorInput,
    ): Promise<ExportJobEventRecord[]> {
      const events = await db.exportJobEvent.findMany({
        where: toJobEventWhere(jobId, cursor),
        orderBy: {
          id: "asc",
        },
        take: toTake(cursor),
      });

      return events.map(mapExportJobEventRecord);
    },

    async listEventsByProjectId(
      projectId: string,
      cursor?: ExportEventCursorInput,
    ): Promise<ExportJobEventRecord[]> {
      const events = await db.exportJobEvent.findMany({
        where: toProjectEventWhere(projectId, cursor),
        orderBy: {
          id: "asc",
        },
        take: toTake(cursor),
      });

      return events.map(mapExportJobEventRecord);
    },
  };
}
