import { UnrecoverableError, Worker, type Job } from "bullmq";

import type { QueueRedisConnection } from "./connection";
import {
  EXPORT_RENDER_JOB_NAME,
  EXPORT_RENDER_QUEUE_NAME,
  type ExportRenderJobData,
} from "./types";

export type ExportJobQueueJob = Job<ExportRenderJobData, void, string>;
export type ExportJobWorker = Worker<ExportRenderJobData, void, string>;

export function createUnrecoverableQueueError(error: Error | string): UnrecoverableError {
  return new UnrecoverableError(typeof error === "string" ? error : error.message);
}

export function createExportJobWorker(input: {
  connection: QueueRedisConnection;
  prefix?: string;
  concurrency?: number;
  onJob: (input: {
    job: ExportJobQueueJob;
    message: ExportRenderJobData;
    attemptNumber: number;
    maxAttempts: number;
  }) => Promise<void>;
}): ExportJobWorker {
  return new Worker<ExportRenderJobData, void, string>(
    EXPORT_RENDER_QUEUE_NAME,
    async (job) => {
      const maxAttempts =
        typeof job.opts.attempts === "number" ? Math.max(1, job.opts.attempts) : 1;

      await input.onJob({
        job,
        message: job.data,
        attemptNumber: job.attemptsMade + 1,
        maxAttempts,
      });
    },
    {
      connection: input.connection,
      concurrency: Math.max(1, input.concurrency ?? 1),
      prefix: input.prefix,
    },
  );
}

export function isExportRenderJob(job: ExportJobQueueJob): boolean {
  return job.name === EXPORT_RENDER_JOB_NAME;
}
