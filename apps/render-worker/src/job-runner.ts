import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ExportArtifactDescriptor, ExportJobStage } from "@spectral/render-session";
import type { ExportRenderJobData } from "@spectral/queue";

import {
  NonRetryableWorkerError,
  WorkerCancelledError,
  isRetryableWorkerError,
  toWorkerError,
} from "./errors";
import { HeartbeatReporter, type HeartbeatActivity } from "./heartbeat";
import type {
  RenderExecutionResult,
  RenderExecutor,
  RenderExecutorStageUpdate,
} from "./render-executor";
import type {
  RenderWorkerJobSnapshot,
  RenderWorkerSessionClient,
} from "./session-client";

type JobRunnerOutcome =
  | {
      status: "completed" | "failed" | "cancelled" | "noop";
    }
  | {
      status: "retry";
      error: Error;
    };

type JobRunnerContext = {
  message: ExportRenderJobData;
  attemptNumber: number;
  maxAttempts: number;
  workerId: string;
};

type JobRunnerDependencies = {
  executor: RenderExecutor;
  sessionClient: RenderWorkerSessionClient;
  heartbeatIntervalMs: number;
  cancelPollIntervalMs: number;
  workRootDir: string;
};

async function createJobWorkspace(input: {
  rootDir: string;
  exportJobId: string;
  attempt: number;
}) {
  const workDir = join(input.rootDir, input.exportJobId, `attempt-${input.attempt}`);

  await mkdir(workDir, { recursive: true });

  for (const directory of ["assets", "frames", "encoded", "diagnostics", "logs"]) {
    await mkdir(join(workDir, directory), {
      recursive: true,
    });
  }

  return workDir;
}

function isTerminalStatus(status: RenderWorkerJobSnapshot["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function buildFailureMetadata(
  error: ReturnType<typeof toWorkerError>,
  attemptNumber: number,
  maxAttempts: number,
) {
  return {
    failure: {
      code: error.code,
      stage: error.stage,
      retryable: error.retryable,
      details: error.details ?? {},
      attempt: attemptNumber,
      maxAttempts,
    },
  };
}

export async function runExportJobAttempt(
  input: JobRunnerContext,
  dependencies: JobRunnerDependencies,
): Promise<JobRunnerOutcome> {
  const session = await dependencies.sessionClient.fetchSession(input.message.exportJobId);
  const snapshot = await dependencies.sessionClient.getJobSnapshot(session);

  if (isTerminalStatus(snapshot.status)) {
    return {
      status: "noop",
    };
  }

  const workDir = await createJobWorkspace({
    rootDir: dependencies.workRootDir,
    exportJobId: session.exportJobId,
    attempt: input.attemptNumber,
  });

  await writeFile(
    join(workDir, "session.json"),
    `${JSON.stringify(session, null, 2)}\n`,
    "utf8",
  );

  let currentStage: ExportJobStage = "session_ready";
  let currentProgressPct = 0;
  let currentDetails: Record<string, unknown> = {
    dispatchClass: input.message.dispatchClass,
    priority: input.message.priority,
    requestedAttempt: input.message.requestedAttempt,
    workDir,
  };
  let lastStatusPollAt = 0;

  const heartbeat = new HeartbeatReporter({
    session,
    sessionClient: dependencies.sessionClient,
    workerId: input.workerId,
    attempt: input.attemptNumber,
    intervalMs: dependencies.heartbeatIntervalMs,
    initialState: {
      stage: currentStage,
      progressPct: currentProgressPct,
      message: "Worker accepted export job.",
      details: currentDetails,
    },
  });

  heartbeat.start();

  const ensureNotCancelled = async (reason: string, options: { force?: boolean } = {}) => {
    const now = Date.now();

    if (
      !options.force &&
      now - lastStatusPollAt < dependencies.cancelPollIntervalMs
    ) {
      return;
    }

    lastStatusPollAt = now;

    const status = await dependencies.sessionClient.getJobSnapshot(session);

    if (status.status === "cancelled") {
      throw new WorkerCancelledError(`Export job cancelled while ${reason}.`, currentStage, {
        exportJobId: session.exportJobId,
        statusPath: session.routes.public.statusPath,
      });
    }

    if (status.status === "completed" || status.status === "failed") {
      throw new NonRetryableWorkerError(
        `Export job became terminal (${status.status}) while ${reason}.`,
        {
          code: "EXPORT_JOB_TERMINATED",
          stage: currentStage,
          details: {
            exportJobId: session.exportJobId,
            status: status.status,
          },
        },
      );
    }
  };

  const setStage = async (update: RenderExecutorStageUpdate) => {
    currentStage = update.stage;

    if (update.progressPct !== undefined && update.progressPct !== null) {
      currentProgressPct = update.progressPct;
    }

    if (update.details !== undefined) {
      currentDetails = {
        ...currentDetails,
        ...update.details,
      };
    }

    await dependencies.sessionClient.updateStage(session, {
      workerId: input.workerId,
      attempt: input.attemptNumber,
      stage: update.stage,
      progressPct: update.progressPct ?? currentProgressPct,
      message: update.message ?? null,
      details: currentDetails,
    });

    const activity: HeartbeatActivity = {
      stage: update.stage,
      progressPct: update.progressPct ?? currentProgressPct,
      message: update.message ?? null,
      details: currentDetails,
    };

    heartbeat.noteActivity(activity);
  };

  const reportArtifact = async (
    artifact: ExportArtifactDescriptor,
    message?: string | null,
  ) => {
    await dependencies.sessionClient.createArtifact(session, {
      workerId: input.workerId,
      attempt: input.attemptNumber,
      artifact,
      message: message ?? null,
    });

    heartbeat.noteActivity(
      {
        stage: currentStage,
        progressPct: currentProgressPct,
        message:
          message ??
          `Artifact ${artifact.kind} registered for ${session.exportJobId}.`,
        details: {
          ...currentDetails,
          artifactKind: artifact.kind,
          artifactStorageKey: artifact.storageKey,
        },
      },
      {
        activeSignal: true,
      },
    );
  };

  let finalizationAttempted = false;

  try {
    await setStage({
      stage: "session_ready",
      progressPct: 0,
      message: "Worker accepted export job.",
      details: currentDetails,
    });
    await ensureNotCancelled("preparing the render session", {
      force: true,
    });

    const result: RenderExecutionResult = await dependencies.executor.execute({
      session,
      workDir,
      attempt: input.attemptNumber,
      workerId: input.workerId,
      resolveUrl: dependencies.sessionClient.resolveUrl,
      setStage,
      reportArtifact,
      throwIfCancelled: ensureNotCancelled,
    });

    await ensureNotCancelled("finalizing a completed export", {
      force: true,
    });
    await setStage({
      stage: "finalizing",
      progressPct: 95,
      message: "Render pipeline finished. Finalizing export job.",
      details: {
        ...currentDetails,
        workDir,
      },
    });
    await heartbeat.stop();

    finalizationAttempted = true;

    await dependencies.sessionClient.finalize(session, {
      workerId: input.workerId,
      attempt: input.attemptNumber,
      status: "completed",
      progressPct: 100,
      message: "Export job completed.",
      outputStorageKey: result.outputStorageKey ?? null,
      posterStorageKey: result.posterStorageKey ?? null,
      metadata: {
        workDir,
        ...(result.metadata ?? {}),
      },
    });

    return {
      status: "completed",
    };
  } catch (error) {
    await heartbeat.stop().catch(() => {});

    const workerError = toWorkerError(error, {
      stage: currentStage,
    });
    const canRetry =
      isRetryableWorkerError(workerError) && input.attemptNumber < input.maxAttempts;

    if (finalizationAttempted) {
      if (canRetry) {
        return {
          status: "retry",
          error: workerError,
        };
      }

      throw workerError;
    }

    if (workerError instanceof WorkerCancelledError) {
      await setStage({
        stage: "finalizing",
        progressPct: currentProgressPct,
        message: "Cancellation acknowledged. Finalizing export job.",
        details: {
          ...currentDetails,
          cancellation: true,
        },
      });

      await dependencies.sessionClient.finalize(session, {
        workerId: input.workerId,
        attempt: input.attemptNumber,
        status: "cancelled",
        progressPct: currentProgressPct,
        message: workerError.message,
        errorCode: workerError.code,
        errorMessage: workerError.message,
        metadata: buildFailureMetadata(
          workerError,
          input.attemptNumber,
          input.maxAttempts,
        ),
      });

      return {
        status: "cancelled",
      };
    }

    if (canRetry) {
      return {
        status: "retry",
        error: workerError,
      };
    }

    await setStage({
      stage: "finalizing",
      progressPct: currentProgressPct,
      message: "Attempt failed. Finalizing export job as failed.",
      details: {
        ...currentDetails,
        failureCode: workerError.code,
      },
    });

    await dependencies.sessionClient.finalize(session, {
      workerId: input.workerId,
      attempt: input.attemptNumber,
      status: "failed",
      progressPct: currentProgressPct,
      message: workerError.message,
      errorCode: workerError.code,
      errorMessage: workerError.message,
      metadata: buildFailureMetadata(
        workerError,
        input.attemptNumber,
        input.maxAttempts,
      ),
    });

    return {
      status: "failed",
    };
  }
}
