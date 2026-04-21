import type { DbClient, JsonRecord } from "./shared";

export type CreateExportJobInput = {
  id?: string;
  projectId: string;
  snapshotId: string;
  format: "mp4" | "mov" | "webm";
  width: number;
  height: number;
  fps: number;
  durationMs?: number | null;
  metadata?: JsonRecord;
};

export function createExportJobRepository(db: DbClient) {
  return {
    async createQueuedJob(input: CreateExportJobInput) {
      return db.exportJob.create({
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
          metadata: input.metadata ?? {},
          queuedAt: new Date(),
        },
      });
    },

    async appendEvent(
      jobId: string,
      input: {
        projectId?: string | null;
        level?: "info" | "warning" | "error";
        type: string;
        message?: string | null;
        progress?: number | null;
        payload?: JsonRecord;
      },
    ) {
      return db.exportJobEvent.create({
        data: {
          jobId,
          projectId: input.projectId ?? null,
          level: input.level ?? "info",
          type: input.type,
          message: input.message ?? null,
          progress: input.progress ?? null,
          payload: input.payload ?? {},
        },
      });
    },

    async updateJobStatus(
      jobId: string,
      input: {
        status: "queued" | "running" | "completed" | "failed" | "cancelled";
        progress?: number;
        outputStorageKey?: string | null;
        posterStorageKey?: string | null;
        errorCode?: string | null;
        errorMessage?: string | null;
        attempts?: number;
        metadata?: JsonRecord;
      },
    ) {
      const now = new Date();

      return db.exportJob.update({
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
          metadata: input.metadata ?? undefined,
          ...(input.status === "running" ? { startedAt: now } : {}),
          ...(input.status === "completed" ? { completedAt: now } : {}),
          ...(input.status === "failed" ? { failedAt: now } : {}),
          ...(input.status === "cancelled" ? { cancelledAt: now } : {}),
        },
      });
    },

    async getJobById(jobId: string) {
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
        ...job,
        events,
      };
    },

    async listJobsByProjectId(projectId: string) {
      return db.exportJob.findMany({
        where: {
          projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },
  };
}
