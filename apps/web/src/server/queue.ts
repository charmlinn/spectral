import {
  buildExportRenderJobData,
  closeQueueResources,
  createExportJobQueue,
  createQueueConnection,
  enqueueExportJob,
  type ExportRenderJobData,
} from "@spectral/queue";

import { getServerEnv } from "./env";

export async function enqueueExportRenderJob(
  message: Pick<ExportRenderJobData, "exportJobId" | "requestedAt"> &
    Partial<Pick<ExportRenderJobData, "dispatchClass" | "priority" | "requestedAttempt">>,
): Promise<void> {
  const env = getServerEnv();
  const connection = createQueueConnection(env.redisUrl);
  const queue = createExportJobQueue({
    connection,
    prefix: env.redisQueuePrefix,
  });

  try {
    await enqueueExportJob(queue, buildExportRenderJobData(message), {
      attempts: env.exportMaxAttempts,
      backoffMs: env.exportRetryDelayMs,
    });
  } finally {
    await closeQueueResources({
      queue,
      connection,
    });
  }
}
