import assert from "node:assert/strict";
import test from "node:test";

import type { CreateRenderArtifactInput, ExportJobRecord, RenderArtifactRecord } from "@spectral/db";
import type {
  ExportArtifactCreatedPayload,
  ExportJobFinalizePayload,
  ExportJobStageUpdatePayload,
  WorkerHeartbeatPayload,
} from "../render-session";

import { AppError } from "../errors";
import {
  assertHeartbeatStageAllowed,
  assertStageTransitionAllowed,
  assertWorkerMutationAllowed,
  getOrCreateRenderArtifact,
  isStageUpdateIdempotent,
  planFinalizeMutation,
  type ExportJobExecutionSnapshot,
} from "./export-control-plane";

function createJob(overrides: Partial<ExportJobRecord> = {}): ExportJobRecord {
  const now = new Date("2026-04-23T00:00:00.000Z");

  return {
    id: "export-job-1",
    projectId: "project-1",
    snapshotId: "snapshot-1",
    status: "running",
    format: "mp4",
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: 15_000,
    attempts: 1,
    progress: 10,
    outputStorageKey: null,
    posterStorageKey: null,
    errorCode: null,
    errorMessage: null,
    metadata: {},
    createdAt: now,
    queuedAt: now,
    startedAt: now,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function createExecution(
  overrides: Partial<ExportJobExecutionSnapshot> = {},
): ExportJobExecutionSnapshot {
  return {
    stage: "assets_preflight",
    workerId: "worker-1",
    attempt: 1,
    heartbeatAt: "2026-04-23T00:00:01.000Z",
    progressPct: 10,
    message: "Preparing assets.",
    updatedAt: "2026-04-23T00:00:01.000Z",
    ...overrides,
  };
}

function createStagePayload(
  overrides: Partial<ExportJobStageUpdatePayload> = {},
): ExportJobStageUpdatePayload {
  return {
    workerId: "worker-1",
    attempt: 1,
    stage: "assets_materializing",
    progressPct: 20,
    message: "Materializing assets.",
    details: {},
    ...overrides,
  };
}

function createFinalizePayload(
  overrides: Partial<ExportJobFinalizePayload> = {},
): ExportJobFinalizePayload {
  return {
    workerId: "worker-1",
    attempt: 1,
    status: "completed",
    progressPct: 100,
    message: "Export job completed.",
    outputStorageKey: "exports/output.mp4",
    posterStorageKey: "exports/poster.jpg",
    metadata: {},
    ...overrides,
  };
}

function createArtifactPayload(
  overrides: Partial<ExportArtifactCreatedPayload> = {},
): ExportArtifactCreatedPayload {
  return {
    workerId: "worker-1",
    attempt: 1,
    artifact: {
      kind: "thumbnail",
      storageKey: "artifacts/thumb-1.png",
      mimeType: "image/png",
      byteSize: 128,
      metadata: {},
    },
    message: "Thumbnail uploaded.",
    ...overrides,
  };
}

function createHeartbeatPayload(
  overrides: Partial<WorkerHeartbeatPayload> = {},
): WorkerHeartbeatPayload {
  return {
    workerId: "worker-1",
    attempt: 1,
    heartbeatAt: "2026-04-23T00:00:05.000Z",
    stage: "assets_materializing",
    progressPct: 20,
    message: "Still running.",
    details: {},
    ...overrides,
  };
}

function expectAppError(error: unknown, code: string) {
  assert.ok(error instanceof AppError);
  assert.equal(error.code, code);
}

test("allows a normal forward stage update for the active worker attempt", () => {
  const job = createJob();
  const execution = createExecution();
  const payload = createStagePayload();

  assert.doesNotThrow(() => {
    assertWorkerMutationAllowed({
      job,
      execution,
      workerId: payload.workerId,
      attempt: payload.attempt,
      action: "update the export stage",
    });
    assertStageTransitionAllowed({
      exportJobId: job.id,
      currentStage: execution.stage,
      currentAttempt: execution.attempt,
      nextAttempt: payload.attempt,
      nextStage: payload.stage,
    });
  });

  assert.equal(
    isStageUpdateIdempotent({
      execution,
      payload,
      normalizedProgress: payload.progressPct,
    }),
    false,
  );
});

test("rejects worker mutations after terminal completion, failure, or cancellation", () => {
  for (const status of ["completed", "failed", "cancelled"] as const) {
    const job = createJob({ status });

    assert.throws(
      () =>
        assertWorkerMutationAllowed({
          job,
          execution: createExecution(),
          workerId: "worker-1",
          attempt: 1,
          action: "update the export stage",
        }),
      (error) => {
        expectAppError(error, "EXPORT_JOB_TERMINAL");
        return true;
      },
    );
  }
});

test("rejects stale attempts and different workers on the same attempt", () => {
  const job = createJob();
  const execution = createExecution({ attempt: 2, workerId: "worker-2" });

  assert.throws(
    () =>
      assertWorkerMutationAllowed({
        job,
        execution,
        workerId: "worker-1",
        attempt: 1,
        action: "record a worker heartbeat",
      }),
    (error) => {
      expectAppError(error, "EXPORT_JOB_STALE_ATTEMPT");
      return true;
    },
  );

  assert.throws(
    () =>
      assertWorkerMutationAllowed({
        job,
        execution,
        workerId: "worker-1",
        attempt: 2,
        action: "record a worker heartbeat",
      }),
    (error) => {
      expectAppError(error, "EXPORT_JOB_WORKER_MISMATCH");
      return true;
    },
  );
});

test("rejects stage regression within the same attempt but allows a newer attempt to restart", () => {
  const job = createJob();

  assert.throws(
    () =>
      assertStageTransitionAllowed({
        exportJobId: job.id,
        currentStage: "encoding",
        currentAttempt: 2,
        nextAttempt: 2,
        nextStage: "rendering",
      }),
    (error) => {
      expectAppError(error, "EXPORT_JOB_STAGE_REGRESSION");
      return true;
    },
  );

  assert.doesNotThrow(() =>
    assertStageTransitionAllowed({
      exportJobId: job.id,
      currentStage: "encoding",
      currentAttempt: 2,
      nextAttempt: 3,
      nextStage: "session_ready",
    }),
  );
});

test("heartbeat stage updates follow the same transition rules", () => {
  const job = createJob();

  assert.throws(
    () =>
      assertHeartbeatStageAllowed({
        exportJobId: job.id,
        currentAttempt: 1,
        currentStage: "uploading",
        payload: createHeartbeatPayload({
          attempt: 1,
          stage: "rendering",
        }),
      }),
    (error) => {
      expectAppError(error, "EXPORT_JOB_STAGE_REGRESSION");
      return true;
    },
  );

  assert.doesNotThrow(() =>
    assertHeartbeatStageAllowed({
      exportJobId: job.id,
      currentAttempt: 1,
      currentStage: "uploading",
      payload: createHeartbeatPayload({
        attempt: 2,
        stage: "session_ready",
      }),
    }),
  );
});

test("artifact registration is idempotent when the same storage key is reported twice", async () => {
  const storedArtifacts = new Map<string, RenderArtifactRecord>();

  const repository = {
    async createArtifact(input: CreateRenderArtifactInput) {
      const artifact: RenderArtifactRecord = {
        id: `artifact-${storedArtifacts.size + 1}`,
        projectId: input.projectId ?? null,
        exportJobId: input.exportJobId ?? null,
        kind: input.kind,
        storageKey: input.storageKey,
        mimeType: input.mimeType ?? null,
        byteSize:
          input.byteSize === null || input.byteSize === undefined
            ? null
            : BigInt(input.byteSize),
        metadata: input.metadata ?? {},
        createdAt: new Date("2026-04-23T00:00:10.000Z"),
      };

      storedArtifacts.set(input.storageKey, artifact);
      return artifact;
    },
    async getArtifactByStorageKey(storageKey: string) {
      return storedArtifacts.get(storageKey) ?? null;
    },
  };

  const payload = createArtifactPayload().artifact;
  const first = await getOrCreateRenderArtifact({
    repository,
    exportJobId: "export-job-1",
    projectId: "project-1",
    payload,
  });
  const second = await getOrCreateRenderArtifact({
    repository,
    exportJobId: "export-job-1",
    projectId: "project-1",
    payload,
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.artifact.id, first.artifact.id);
});

test("finalize accepts compatible reentry but rejects conflicting terminal finalize requests", () => {
  const execution = createExecution({ stage: "finalizing" });

  const noopDecision = planFinalizeMutation({
    job: createJob({
      status: "completed",
      outputStorageKey: "exports/output.mp4",
      posterStorageKey: "exports/poster.jpg",
    }),
    execution,
    payload: createFinalizePayload(),
  });

  assert.equal(noopDecision.kind, "noop");

  assert.throws(
    () =>
      planFinalizeMutation({
        job: createJob({
          status: "completed",
          outputStorageKey: "exports/output.mp4",
        }),
        execution,
        payload: createFinalizePayload({
          outputStorageKey: "exports/other-output.mp4",
        }),
      }),
    (error) => {
      expectAppError(error, "EXPORT_JOB_FINALIZE_CONFLICT");
      return true;
    },
  );

  assert.throws(
    () =>
      planFinalizeMutation({
        job: createJob({
          status: "failed",
          errorCode: "RENDER_TIMEOUT",
        }),
        execution,
        payload: createFinalizePayload({
          status: "completed",
        }),
      }),
    (error) => {
      expectAppError(error, "EXPORT_JOB_FINALIZE_CONFLICT");
      return true;
    },
  );
});
