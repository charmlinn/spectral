import {
  closeQueueResources,
  createExportJobWorker,
  createQueueConnection,
  createUnrecoverableQueueError,
  isExportRenderJob,
} from "@spectral/queue";

import { isRetryableWorkerError, toWorkerError } from "./errors";
import { getWorkerEnv } from "./env";
import { runExportJobAttempt } from "./job-runner";
import { PipelineRenderExecutor, type RenderExecutor } from "./render-executor";
import { createRenderWorkerSessionClient } from "./session-client";

function toErrorDetails(error: unknown) {
  const workerError = toWorkerError(error);

  return {
    code: workerError.code,
    message: workerError.message,
    retryable: workerError.retryable,
    stage: workerError.stage,
    details: workerError.details,
  };
}

export async function startRenderWorker(
  executor: RenderExecutor = new PipelineRenderExecutor(),
) {
  const env = getWorkerEnv();
  const connection = createQueueConnection(env.redisUrl);
  const sessionClient = createRenderWorkerSessionClient({
    baseUrl: env.webBaseUrl,
    internalToken: env.internalExportsToken,
  });

  const worker = createExportJobWorker({
    connection,
    prefix: env.redisQueuePrefix,
    concurrency: env.exportWorkerConcurrency,
    onJob: async ({ job, message, attemptNumber, maxAttempts }) => {
      if (!isExportRenderJob(job)) {
        throw createUnrecoverableQueueError(
          `Unsupported queue job name: ${job.name}`,
        );
      }

      try {
        const result = await runExportJobAttempt(
          {
            message,
            attemptNumber,
            maxAttempts,
            workerId: env.workerId,
          },
          {
            executor,
            sessionClient,
            heartbeatIntervalMs: env.heartbeatIntervalMs,
            cancelPollIntervalMs: env.cancelPollIntervalMs,
            workRootDir: env.workRootDir,
          },
        );

        if (result.status === "retry") {
          throw result.error;
        }
      } catch (error) {
        const workerError = toWorkerError(error);
        const unrecoverableMessage = `${workerError.code}: ${workerError.message}`;

        if (isRetryableWorkerError(workerError)) {
          throw workerError;
        }

        throw createUnrecoverableQueueError(unrecoverableMessage);
      }
    },
  });

  worker.on("error", (error) => {
    console.error("Render worker queue error.", error);
  });

  worker.on("failed", (job, error) => {
    console.error("Render job attempt failed.", {
      exportJobId: job?.data.exportJobId ?? null,
      dispatchClass: job?.data.dispatchClass ?? null,
      priority: job?.data.priority ?? null,
      requestedAttempt: job?.data.requestedAttempt ?? null,
      attemptsMade: job?.attemptsMade ?? null,
      workerId: env.workerId,
      error: toErrorDetails(error),
    });
  });

  await worker.waitUntilReady();

  console.log("Render worker is consuming export jobs.", {
    workerId: env.workerId,
    concurrency: env.exportWorkerConcurrency,
    workRootDir: env.workRootDir,
  });

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = async () => {
    shutdownPromise ??= closeQueueResources({
      worker,
      connection,
    });

    await shutdownPromise;
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  return {
    shutdown,
  };
}
