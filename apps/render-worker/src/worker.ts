import {
  disconnectDataLayer,
  getDataLayer,
} from "@spectral/db";
import {
  closeQueueResources,
  createExportJobWorker,
  createQueueConnection,
  createUnrecoverableQueueError,
  isExportRenderJob,
} from "@spectral/queue";

import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";
import { getWorkerEnv } from "./env";
import { HttpRenderExecutor, type RenderExecutor } from "./render-executor";

function buildRenderPageUrl(exportJobId: string, webBaseUrl: string): string {
  return new URL(`/render/export/${exportJobId}`, webBaseUrl).toString();
}

function buildRenderBootstrapUrl(exportJobId: string, webBaseUrl: string): string {
  return new URL(`/render/export/${exportJobId}/bootstrap`, webBaseUrl).toString();
}

function toErrorDetails(error: unknown) {
  if (error instanceof RetryableWorkerError || error instanceof NonRetryableWorkerError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNEXPECTED_WORKER_ERROR",
      message: error.message,
    };
  }

  return {
    code: "UNKNOWN_WORKER_ERROR",
    message: String(error),
  };
}

async function handleExportJobMessage(
  input: {
    exportJobId: string;
    attemptNumber: number;
    maxAttempts: number;
  },
  dependencies: {
    executor: RenderExecutor;
    webBaseUrl: string;
  },
): Promise<void> {
  const dataLayer = getDataLayer();
  const jobDetail = await dataLayer.exportJobRepository.getJobById(input.exportJobId);

  if (!jobDetail) {
    return;
  }

  const job = jobDetail.job;

  if (job.status === "completed" || job.status === "cancelled") {
    return;
  }

  if (job.attempts >= input.maxAttempts) {
    await dataLayer.exportJobRepository.updateJobStatus(job.id, {
      status: "failed",
      attempts: job.attempts,
      errorCode: "MAX_ATTEMPTS_REACHED",
      errorMessage: "Export job exceeded maximum attempts before worker execution.",
    });
    await dataLayer.exportJobRepository.appendEvent(job.id, {
      projectId: job.projectId,
      level: "error",
      type: "failed",
      message: "Export job exceeded maximum attempts.",
      progress: job.progress,
    });

    return;
  }

  const currentAttempt = Math.max(job.attempts + 1, input.attemptNumber);

  await dataLayer.exportJobRepository.updateJobStatus(job.id, {
    status: "running",
    progress: 5,
    attempts: currentAttempt,
  });
  await dataLayer.exportJobRepository.appendEvent(job.id, {
    projectId: job.projectId,
    type: "started",
    message: "Render worker started processing export job.",
    progress: 5,
    payload: {
      attempt: currentAttempt,
      maxAttempts: input.maxAttempts,
    },
  });

  try {
    const result = await dependencies.executor.execute({
      exportJobId: job.id,
      attempt: currentAttempt,
      workerId: `${process.env.HOSTNAME ?? "render-worker"}:${process.pid}`,
      renderPageUrl: buildRenderPageUrl(job.id, dependencies.webBaseUrl),
      renderBootstrapUrl: buildRenderBootstrapUrl(job.id, dependencies.webBaseUrl),
    });

    await dataLayer.exportJobRepository.updateJobStatus(job.id, {
      status: "completed",
      progress: 100,
      attempts: currentAttempt,
      outputStorageKey: result.outputStorageKey ?? null,
      posterStorageKey: result.posterStorageKey ?? null,
      metadata: result.metadata,
    });
    await dataLayer.exportJobRepository.appendEvent(job.id, {
      projectId: job.projectId,
      type: "completed",
      message: "Export job completed.",
      progress: 100,
      payload: result.metadata,
    });
  } catch (error) {
    const details = toErrorDetails(error);
    const canRetry =
      error instanceof RetryableWorkerError &&
      currentAttempt < input.maxAttempts;

    if (canRetry) {
      await dataLayer.exportJobRepository.updateJobStatus(job.id, {
        status: "queued",
        progress: 0,
        attempts: currentAttempt,
        errorCode: details.code,
        errorMessage: details.message,
      });
      await dataLayer.exportJobRepository.appendEvent(job.id, {
        projectId: job.projectId,
        level: "warning",
        type: "retry_scheduled",
        message: details.message,
        progress: job.progress,
        payload: {
          attempt: currentAttempt,
          maxAttempts: input.maxAttempts,
          errorCode: details.code,
        },
      });

      throw error;
    }

    await dataLayer.exportJobRepository.updateJobStatus(job.id, {
      status: "failed",
      progress: job.progress,
      attempts: currentAttempt,
      errorCode: details.code,
      errorMessage: details.message,
    });
    await dataLayer.exportJobRepository.appendEvent(job.id, {
      projectId: job.projectId,
      level: "error",
      type: "failed",
      message: details.message,
      progress: job.progress,
      payload: {
        attempt: currentAttempt,
        maxAttempts: input.maxAttempts,
        errorCode: details.code,
      },
    });

    throw createUnrecoverableQueueError(`${details.code}: ${details.message}`);
  }
}

export async function startRenderWorker(
  executor: RenderExecutor = new HttpRenderExecutor(),
) {
  const env = getWorkerEnv();
  const connection = createQueueConnection(env.redisUrl);
  const worker = createExportJobWorker({
    connection,
    prefix: env.redisQueuePrefix,
    concurrency: env.exportWorkerConcurrency,
    onJob: async ({ job, message, attemptNumber, maxAttempts }) => {
      if (!isExportRenderJob(job)) {
        throw createUnrecoverableQueueError(`Unsupported queue job name: ${job.name}`);
      }

      await handleExportJobMessage(
        {
          exportJobId: message.exportJobId,
          attemptNumber,
          maxAttempts,
        },
        {
          executor,
          webBaseUrl: env.webBaseUrl,
        },
      );
    },
  });

  worker.on("error", (error) => {
    console.error("Render worker queue error.", error);
  });

  worker.on("failed", (job, error) => {
    console.error(
      "Render job attempt failed.",
      {
        exportJobId: job?.data.exportJobId ?? null,
        attemptsMade: job?.attemptsMade ?? null,
      },
      error,
    );
  });

  console.log("Render worker is consuming export jobs.");

  await worker.waitUntilReady();

  const shutdown = async () => {
    await closeQueueResources({
      worker,
      connection,
    });
    await disconnectDataLayer();
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
