import {
  createExportJobRepository,
  disconnectPrismaClient,
  getPrismaClient,
} from "@spectral/db";
import {
  closeAmqpResources,
  consumeExportJobs,
  createConnection,
  type ExportJobConsumeResult,
} from "@spectral/queue";

import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";
import { getWorkerEnv } from "./env";
import {
  type RenderExecutor,
  UnimplementedRenderExecutor,
} from "./render-executor";

function buildRenderPageUrl(exportJobId: string, webBaseUrl: string): string {
  return new URL(`/render/export/${exportJobId}`, webBaseUrl).toString();
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
    retryCount: number;
  },
  dependencies: {
    executor: RenderExecutor;
    exportMaxAttempts: number;
    webBaseUrl: string;
  },
): Promise<ExportJobConsumeResult> {
  const prisma = getPrismaClient();
  const exportJobRepository = createExportJobRepository(prisma);
  const job = await exportJobRepository.getJobById(input.exportJobId);

  if (!job) {
    return {
      action: "ack",
    };
  }

  if (job.status === "completed" || job.status === "cancelled") {
    return {
      action: "ack",
    };
  }

  if (job.attempts >= dependencies.exportMaxAttempts) {
    await exportJobRepository.updateJobStatus(job.id, {
      status: "failed",
      attempts: job.attempts,
      errorCode: "MAX_ATTEMPTS_REACHED",
      errorMessage: "Export job exceeded maximum attempts before worker execution.",
    });
    await exportJobRepository.appendEvent(job.id, {
      projectId: job.projectId,
      level: "error",
      type: "failed",
      message: "Export job exceeded maximum attempts.",
      progress: job.progress,
    });

    return {
      action: "dead",
      retryCount: input.retryCount,
    };
  }

  const nextAttempts = job.attempts + 1;

  await exportJobRepository.updateJobStatus(job.id, {
    status: "running",
    progress: 5,
    attempts: nextAttempts,
  });
  await exportJobRepository.appendEvent(job.id, {
    projectId: job.projectId,
    type: "started",
    message: "Render worker started processing export job.",
    progress: 5,
    payload: {
      attempt: nextAttempts,
      retryCount: input.retryCount,
    },
  });

  try {
    const result = await dependencies.executor.execute({
      exportJobId: job.id,
      renderPageUrl: buildRenderPageUrl(job.id, dependencies.webBaseUrl),
    });

    await exportJobRepository.updateJobStatus(job.id, {
      status: "completed",
      progress: 100,
      attempts: nextAttempts,
      outputStorageKey: result.outputStorageKey ?? null,
      posterStorageKey: result.posterStorageKey ?? null,
      metadata: result.metadata,
    });
    await exportJobRepository.appendEvent(job.id, {
      projectId: job.projectId,
      type: "completed",
      message: "Export job completed.",
      progress: 100,
      payload: result.metadata,
    });

    return {
      action: "ack",
    };
  } catch (error) {
    const details = toErrorDetails(error);
    const canRetry =
      error instanceof RetryableWorkerError &&
      nextAttempts < dependencies.exportMaxAttempts;

    if (canRetry) {
      await exportJobRepository.updateJobStatus(job.id, {
        status: "queued",
        progress: 0,
        attempts: nextAttempts,
        errorCode: details.code,
        errorMessage: details.message,
      });
      await exportJobRepository.appendEvent(job.id, {
        projectId: job.projectId,
        level: "warning",
        type: "retry_scheduled",
        message: details.message,
        progress: job.progress,
        payload: {
          attempt: nextAttempts,
          retryCount: input.retryCount + 1,
          errorCode: details.code,
        },
      });

      return {
        action: "retry",
        retryCount: input.retryCount + 1,
      };
    }

    await exportJobRepository.updateJobStatus(job.id, {
      status: "failed",
      progress: job.progress,
      attempts: nextAttempts,
      errorCode: details.code,
      errorMessage: details.message,
    });
    await exportJobRepository.appendEvent(job.id, {
      projectId: job.projectId,
      level: "error",
      type: "failed",
      message: details.message,
      progress: job.progress,
      payload: {
        attempt: nextAttempts,
        retryCount: input.retryCount,
        errorCode: details.code,
      },
    });

    return {
      action: "dead",
      retryCount: input.retryCount,
    };
  }
}

export async function startRenderWorker(
  executor: RenderExecutor = new UnimplementedRenderExecutor(),
) {
  const env = getWorkerEnv();
  const connection = await createConnection(env.amqpUrl);
  const channel = await consumeExportJobs(connection, {
    prefetch: env.amqpPrefetch,
    retryDelayMs: env.amqpRetryDelayMs,
    onMessage: ({ message, retryCount }) =>
      handleExportJobMessage(
        {
          exportJobId: message.exportJobId,
          retryCount,
        },
        {
          executor,
          exportMaxAttempts: env.exportMaxAttempts,
          webBaseUrl: env.webBaseUrl,
        },
      ),
  });

  console.log("Render worker is consuming export jobs.");

  const shutdown = async () => {
    await closeAmqpResources({
      channel,
      connection,
    });
    await disconnectPrismaClient();
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
