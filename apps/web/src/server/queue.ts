import {
  closeQueueResources,
  createExportJobQueue,
  createQueueConnection,
  enqueueExportJob,
  type ExportRenderJobData,
} from "@spectral/queue";

import { getServerEnv } from "./env";

export async function enqueueExportRenderJob(message: ExportRenderJobData): Promise<void> {
  const env = getServerEnv();
  const connection = createQueueConnection(env.redisUrl);
  const queue = createExportJobQueue({
    connection,
    prefix: env.redisQueuePrefix,
  });

  try {
    await enqueueExportJob(queue, message, {
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
