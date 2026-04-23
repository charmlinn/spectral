import type {
  ExportJobRecord,
  EventLevel,
  RenderArtifactRecord,
  RenderArtifactRepository,
} from "@spectral/db";
import type {
  ExportArtifactCreatedPayload,
  ExportJobFinalizePayload,
  ExportJobStage,
  ExportJobStageUpdatePayload,
  WorkerHeartbeatPayload,
} from "../render-session";

import { AppError } from "../errors";

const exportJobStages = [
  "session_ready",
  "assets_preflight",
  "assets_materializing",
  "renderer_warmup",
  "rendering",
  "encoding",
  "uploading",
  "finalizing",
] as const satisfies readonly ExportJobStage[];

export type ExportJobExecutionSnapshot = {
  stage: ExportJobStage | null;
  workerId: string | null;
  attempt: number | null;
  heartbeatAt: string | null;
  progressPct: number | null;
  message: string | null;
  updatedAt: string | null;
};

const stageOrder = new Map(exportJobStages.map((stage, index) => [stage, index]));

function createControlPlaneError(input: {
  code:
    | "EXPORT_JOB_TERMINAL"
    | "EXPORT_JOB_STALE_ATTEMPT"
    | "EXPORT_JOB_WORKER_MISMATCH"
    | "EXPORT_JOB_STAGE_REGRESSION"
    | "EXPORT_JOB_FINALIZE_CONFLICT"
    | "EXPORT_ARTIFACT_CONFLICT";
  message: string;
  details: Record<string, unknown>;
  statusCode?: number;
}) {
  return new AppError(input.message, {
    code: input.code,
    statusCode: input.statusCode ?? 409,
    details: input.details,
  });
}

export function isTerminalExportJobStatus(status: ExportJobRecord["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function assertWorkerMutationAllowed(input: {
  job: ExportJobRecord;
  execution: ExportJobExecutionSnapshot;
  workerId: string;
  attempt: number;
  action: string;
}) {
  if (isTerminalExportJobStatus(input.job.status)) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_TERMINAL",
      message: `Cannot ${input.action} for a terminal export job.`,
      details: {
        exportJobId: input.job.id,
        status: input.job.status,
      },
    });
  }

  if (
    input.execution.attempt !== null &&
    Number.isFinite(input.execution.attempt) &&
    input.attempt < input.execution.attempt
  ) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_STALE_ATTEMPT",
      message: `Cannot ${input.action} from a stale worker attempt.`,
      details: {
        exportJobId: input.job.id,
        currentAttempt: input.execution.attempt,
        requestedAttempt: input.attempt,
        workerId: input.workerId,
      },
    });
  }

  if (
    input.execution.attempt !== null &&
    input.attempt === input.execution.attempt &&
    input.execution.workerId &&
    input.execution.workerId !== input.workerId
  ) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_WORKER_MISMATCH",
      message: `Cannot ${input.action} from a different worker for the current attempt.`,
      details: {
        exportJobId: input.job.id,
        attempt: input.attempt,
        currentWorkerId: input.execution.workerId,
        requestedWorkerId: input.workerId,
      },
    });
  }
}

export function assertStageTransitionAllowed(input: {
  exportJobId: string;
  currentStage: ExportJobStage | null;
  currentAttempt: number | null;
  nextAttempt: number;
  nextStage: ExportJobStage;
}) {
  if (input.currentStage === null || input.currentStage === input.nextStage) {
    return;
  }

  if (input.currentAttempt !== null && input.nextAttempt > input.currentAttempt) {
    return;
  }

  const currentOrder = stageOrder.get(input.currentStage);
  const nextOrder = stageOrder.get(input.nextStage);

  if (
    currentOrder !== undefined &&
    nextOrder !== undefined &&
    nextOrder < currentOrder
  ) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_STAGE_REGRESSION",
      message: "Export stage cannot move backwards within the same attempt.",
      details: {
        exportJobId: input.exportJobId,
        currentStage: input.currentStage,
        nextStage: input.nextStage,
      },
    });
  }
}

export function isStageUpdateIdempotent(input: {
  execution: ExportJobExecutionSnapshot;
  payload: ExportJobStageUpdatePayload;
  normalizedProgress: number | null | undefined;
}) {
  if (
    input.execution.workerId !== input.payload.workerId ||
    input.execution.attempt !== input.payload.attempt ||
    input.execution.stage !== input.payload.stage
  ) {
    return false;
  }

  if (
    input.normalizedProgress !== undefined &&
    input.execution.progressPct !== input.normalizedProgress
  ) {
    return false;
  }

  if (
    input.payload.message !== undefined &&
    input.execution.message !== input.payload.message
  ) {
    return false;
  }

  return true;
}

function assertTerminalFinalizeCompatible(input: {
  job: ExportJobRecord;
  payload: ExportJobFinalizePayload;
}) {
  if (input.job.status !== input.payload.status) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_FINALIZE_CONFLICT",
      message: "Finalize request conflicts with the existing terminal export status.",
      details: {
        exportJobId: input.job.id,
        currentStatus: input.job.status,
        requestedStatus: input.payload.status,
      },
    });
  }

  if (
    input.payload.status === "completed" &&
    input.job.outputStorageKey &&
    input.payload.outputStorageKey &&
    input.job.outputStorageKey !== input.payload.outputStorageKey
  ) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_FINALIZE_CONFLICT",
      message: "Finalize request conflicts with the completed export artifact.",
      details: {
        exportJobId: input.job.id,
        outputStorageKey: input.job.outputStorageKey,
        requestedOutputStorageKey: input.payload.outputStorageKey,
      },
    });
  }

  if (
    input.payload.status === "completed" &&
    input.job.posterStorageKey &&
    input.payload.posterStorageKey &&
    input.job.posterStorageKey !== input.payload.posterStorageKey
  ) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_FINALIZE_CONFLICT",
      message: "Finalize request conflicts with the completed poster artifact.",
      details: {
        exportJobId: input.job.id,
        posterStorageKey: input.job.posterStorageKey,
        requestedPosterStorageKey: input.payload.posterStorageKey,
      },
    });
  }

  if (
    (input.payload.status === "failed" || input.payload.status === "cancelled") &&
    input.job.errorCode &&
    input.payload.errorCode &&
    input.job.errorCode !== input.payload.errorCode
  ) {
    throw createControlPlaneError({
      code: "EXPORT_JOB_FINALIZE_CONFLICT",
      message: "Finalize request conflicts with the existing terminal error code.",
      details: {
        exportJobId: input.job.id,
        errorCode: input.job.errorCode,
        requestedErrorCode: input.payload.errorCode,
      },
    });
  }
}

export function planFinalizeMutation(input: {
  job: ExportJobRecord;
  execution: ExportJobExecutionSnapshot;
  payload: ExportJobFinalizePayload;
}) {
  if (isTerminalExportJobStatus(input.job.status)) {
    assertTerminalFinalizeCompatible(input);
    return {
      kind: "noop" as const,
    };
  }

  assertWorkerMutationAllowed({
    job: input.job,
    execution: input.execution,
    workerId: input.payload.workerId,
    attempt: input.payload.attempt,
    action: "finalize the export job",
  });

  return {
    kind: "apply" as const,
  };
}

export type ArtifactRegistrationResult = {
  artifact: RenderArtifactRecord;
  created: boolean;
};

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

function assertArtifactConflict(input: {
  artifact: RenderArtifactRecord;
  exportJobId: string;
  projectId: string;
  payload: ExportArtifactCreatedPayload["artifact"];
}) {
  if (
    input.artifact.exportJobId !== input.exportJobId ||
    input.artifact.projectId !== input.projectId
  ) {
    throw createControlPlaneError({
      code: "EXPORT_ARTIFACT_CONFLICT",
      message: "Render artifact storage key is already registered to another export job.",
      details: {
        exportJobId: input.exportJobId,
        storageKey: input.payload.storageKey,
        existingArtifactId: input.artifact.id,
        existingExportJobId: input.artifact.exportJobId,
      },
    });
  }

  if (input.artifact.kind !== input.payload.kind) {
    throw createControlPlaneError({
      code: "EXPORT_ARTIFACT_CONFLICT",
      message: "Render artifact storage key is already registered with another kind.",
      details: {
        exportJobId: input.exportJobId,
        storageKey: input.payload.storageKey,
        existingArtifactId: input.artifact.id,
        existingKind: input.artifact.kind,
        requestedKind: input.payload.kind,
      },
    });
  }
}

export async function getOrCreateRenderArtifact(input: {
  repository: Pick<RenderArtifactRepository, "createArtifact" | "getArtifactByStorageKey">;
  exportJobId: string;
  projectId: string;
  payload: ExportArtifactCreatedPayload["artifact"];
}): Promise<ArtifactRegistrationResult> {
  const existingArtifact =
    await input.repository.getArtifactByStorageKey(input.payload.storageKey);

  if (existingArtifact) {
    assertArtifactConflict({
      artifact: existingArtifact,
      exportJobId: input.exportJobId,
      projectId: input.projectId,
      payload: input.payload,
    });

    return {
      artifact: existingArtifact,
      created: false,
    };
  }

  let artifact: RenderArtifactRecord;

  try {
    artifact = await input.repository.createArtifact({
      projectId: input.projectId,
      exportJobId: input.exportJobId,
      kind: input.payload.kind,
      storageKey: input.payload.storageKey,
      mimeType: input.payload.mimeType ?? null,
      byteSize: input.payload.byteSize ?? null,
      metadata: input.payload.metadata ?? {},
    });
  } catch (error) {
    if (!isUniqueConstraintError(error) || error.code !== "P2002") {
      throw error;
    }

    const concurrentArtifact =
      await input.repository.getArtifactByStorageKey(input.payload.storageKey);

    if (!concurrentArtifact) {
      throw error;
    }

    assertArtifactConflict({
      artifact: concurrentArtifact,
      exportJobId: input.exportJobId,
      projectId: input.projectId,
      payload: input.payload,
    });

    return {
      artifact: concurrentArtifact,
      created: false,
    };
  }

  return {
    artifact,
    created: true,
  };
}

export function toFinalizeEventLevel(status: ExportJobFinalizePayload["status"]): EventLevel {
  return status === "failed" ? "error" : "info";
}

export function assertHeartbeatStageAllowed(input: {
  exportJobId: string;
  currentAttempt: number | null;
  currentStage: ExportJobStage | null;
  payload: WorkerHeartbeatPayload;
}) {
  if (!input.payload.stage) {
    return;
  }

  assertStageTransitionAllowed({
    exportJobId: input.exportJobId,
    currentStage: input.currentStage,
    currentAttempt: input.currentAttempt,
    nextAttempt: input.payload.attempt,
    nextStage: input.payload.stage,
  });
}
