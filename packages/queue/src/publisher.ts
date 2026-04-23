import { Queue } from "bullmq";

import type { QueueRedisConnection } from "./connection";
import {
  DEFAULT_EXPORT_DISPATCH_CLASS,
  DEFAULT_EXPORT_JOB_PRIORITY,
  EXPORT_RENDER_JOB_NAME,
  EXPORT_RENDER_QUEUE_NAME,
  type ExportRenderJobData,
} from "./types";

export type ExportJobQueue = Queue<ExportRenderJobData, void, string>;

export function createExportJobQueue(input: {
  connection: QueueRedisConnection;
  prefix?: string;
}): ExportJobQueue {
  return new Queue<ExportRenderJobData, void, string>(EXPORT_RENDER_QUEUE_NAME, {
    connection: input.connection,
    prefix: input.prefix,
  });
}

export async function enqueueExportJob(
  queue: ExportJobQueue,
  message: ExportRenderJobData,
  options?: {
    attempts?: number;
    backoffMs?: number;
  },
): Promise<void> {
  await queue.add(EXPORT_RENDER_JOB_NAME, message, {
    attempts: Math.max(1, options?.attempts ?? 1),
    backoff: {
      type: "fixed",
      delay: Math.max(0, options?.backoffMs ?? 0),
    },
    jobId: message.exportJobId,
    priority: message.priority ?? DEFAULT_EXPORT_JOB_PRIORITY,
    removeOnComplete: true,
    removeOnFail: false,
  });
}

export function buildExportRenderJobData(
  input: Pick<ExportRenderJobData, "exportJobId" | "requestedAt"> &
    Partial<
      Pick<ExportRenderJobData, "dispatchClass" | "priority" | "requestedAttempt">
    >,
): ExportRenderJobData {
  return {
    exportJobId: input.exportJobId,
    requestedAt: input.requestedAt,
    dispatchClass: input.dispatchClass ?? DEFAULT_EXPORT_DISPATCH_CLASS,
    priority: input.priority ?? DEFAULT_EXPORT_JOB_PRIORITY,
    requestedAttempt: Math.max(1, input.requestedAttempt ?? 1),
  };
}
