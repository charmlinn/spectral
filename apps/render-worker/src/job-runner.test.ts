import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExportArtifactCreatedPayload,
  ExportJobFinalizePayload,
  ExportJobStageUpdatePayload,
  RenderSession,
  WorkerHeartbeatPayload,
} from "@spectral/render-session";
import type { ExportRenderJobData } from "@spectral/queue";

import {
  RetryableWorkerError,
  WorkerCancelledError,
  WorkerExecutionError,
} from "./errors";
import { runExportJobAttempt } from "./job-runner";
import type {
  RenderExecutionResult,
  RenderExecutor,
  RenderExecutorContext,
} from "./render-executor";
import type {
  RenderWorkerJobSnapshot,
  RenderWorkerSessionClient,
} from "./session-client";

function createMessage(overrides: Partial<ExportRenderJobData> = {}): ExportRenderJobData {
  return {
    exportJobId: "job-1",
    requestedAt: "2026-04-23T00:00:00.000Z",
    dispatchClass: "gpu-standard",
    priority: 50,
    requestedAttempt: 1,
    ...overrides,
  };
}

function createSession(exportJobId = "job-1"): RenderSession {
  return {
    protocolVersion: "spectral.render-session.v1",
    sessionId: `session-${exportJobId}`,
    exportJobId,
    projectId: "project-1",
    snapshotId: "snapshot-1",
    createdAt: "2026-04-23T00:00:00.000Z",
    runtime: {
      mode: "export",
      width: 1920,
      height: 1080,
      dpr: 1,
      fps: 30,
      durationMs: 1_000,
      frameCount: 30,
      backgroundColor: null,
    },
    project: {
      document: {
        meta: {
          version: 1,
        },
        scenes: [],
      },
      schemaVersion: 1,
    },
    assets: {
      bindings: [],
      fonts: [],
      audioAnalysis: null,
    },
    output: {
      format: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      posterFrame: null,
      thumbnailFrames: [],
    },
    diagnostics: {
      parityPresetKey: null,
      sampleFrames: [],
      enableFrameHashes: false,
    },
    routes: {
      public: {
        statusPath: `/exports/${exportJobId}`,
        pagePath: `/exports/${exportJobId}/page`,
        bootstrapPath: `/exports/${exportJobId}/bootstrap`,
        cancelPath: `/exports/${exportJobId}/cancel`,
        exportEventsPath: `/exports/${exportJobId}/events`,
        projectEventsPath: "/projects/project-1/events",
      },
      internal: {
        sessionPath: `/api/internal/exports/${exportJobId}/session`,
        heartbeatPath: `/api/internal/exports/${exportJobId}/heartbeat`,
        stagePath: `/api/internal/exports/${exportJobId}/stage`,
        artifactsPath: `/api/internal/exports/${exportJobId}/artifacts`,
        finalizePath: `/api/internal/exports/${exportJobId}/finalize`,
      },
    },
  } as unknown as RenderSession;
}

class FakeSessionClient implements RenderWorkerSessionClient {
  readonly session: RenderSession;
  readonly stageUpdates: ExportJobStageUpdatePayload[] = [];
  readonly artifactPayloads: ExportArtifactCreatedPayload[] = [];
  readonly heartbeatPayloads: WorkerHeartbeatPayload[] = [];
  readonly finalizePayloads: ExportJobFinalizePayload[] = [];
  readonly statusHistory: RenderWorkerJobSnapshot[];
  readonly finalizeError: Error | null;

  constructor(input: {
    session?: RenderSession;
    statusHistory?: RenderWorkerJobSnapshot[];
    finalizeError?: Error | null;
  } = {}) {
    this.session = input.session ?? createSession();
    this.statusHistory = input.statusHistory ?? [
      {
        exportJobId: this.session.exportJobId,
        status: "running",
        progressPct: 0,
        stage: "session_ready",
      },
    ];
    this.finalizeError = input.finalizeError ?? null;
  }

  async fetchSession(exportJobId: string): Promise<RenderSession> {
    assert.equal(exportJobId, this.session.exportJobId);
    return this.session;
  }

  async getJobSnapshot(): Promise<RenderWorkerJobSnapshot> {
    const snapshot = this.statusHistory.shift();
    return (
      snapshot ?? {
        exportJobId: this.session.exportJobId,
        status: "running",
        progressPct: 0,
        stage: "session_ready",
      }
    );
  }

  async reportHeartbeat(_session: RenderSession, payload: WorkerHeartbeatPayload): Promise<void> {
    this.heartbeatPayloads.push(payload);
  }

  async updateStage(
    _session: RenderSession,
    payload: ExportJobStageUpdatePayload,
  ): Promise<void> {
    this.stageUpdates.push(payload);
  }

  async createArtifact(
    _session: RenderSession,
    payload: ExportArtifactCreatedPayload,
  ): Promise<void> {
    this.artifactPayloads.push(payload);
  }

  async finalize(
    _session: RenderSession,
    payload: ExportJobFinalizePayload,
  ): Promise<void> {
    this.finalizePayloads.push(payload);

    if (this.finalizeError) {
      throw this.finalizeError;
    }
  }

  resolveUrl(routePath: string): string {
    return `https://example.test${routePath}`;
  }
}

function createExecutor(
  execute: (context: RenderExecutorContext) => Promise<RenderExecutionResult>,
): RenderExecutor {
  return {
    execute,
  };
}

async function runAttempt(input: {
  sessionClient: RenderWorkerSessionClient;
  executor: RenderExecutor;
  attemptNumber?: number;
  maxAttempts?: number;
  message?: ExportRenderJobData;
}) {
  return runExportJobAttempt(
    {
      message: input.message ?? createMessage(),
      attemptNumber: input.attemptNumber ?? 1,
      maxAttempts: input.maxAttempts ?? 3,
      workerId: "worker-1",
    },
    {
      executor: input.executor,
      sessionClient: input.sessionClient,
      heartbeatIntervalMs: 5,
      cancelPollIntervalMs: 0,
      workRootDir: "/tmp/spectral-job-runner-tests",
    },
  );
}

test("runExportJobAttempt returns retry for retryable execution failures", async () => {
  const sessionClient = new FakeSessionClient();
  let executeCalls = 0;
  const executor = createExecutor(async () => {
    executeCalls += 1;
    throw new RetryableWorkerError("temporary renderer outage", {
      code: "RENDERER_UNAVAILABLE",
      stage: "rendering",
    });
  });

  const result = await runAttempt({
    sessionClient,
    executor,
    maxAttempts: 3,
  });

  assert.equal(executeCalls, 1);
  switch (result.status) {
    case "retry":
      assert.ok(result.error instanceof WorkerExecutionError);
      assert.equal(result.error.code, "RENDERER_UNAVAILABLE");
      break;
    default:
      assert.fail(`expected retry outcome, received ${result.status}`);
  }
  assert.equal(sessionClient.finalizePayloads.length, 0);
});

test("runExportJobAttempt finalizes cancelled jobs without stage writes after cancellation", async () => {
  const sessionClient = new FakeSessionClient({
    statusHistory: [
      {
        exportJobId: "job-1",
        status: "running",
        progressPct: 0,
        stage: "session_ready",
      },
      {
        exportJobId: "job-1",
        status: "running",
        progressPct: 10,
        stage: "rendering",
      },
      {
        exportJobId: "job-1",
        status: "cancelled",
        progressPct: 25,
        stage: "rendering",
      },
    ],
  });

  const executor = createExecutor(async (context) => {
    await context.setStage({
      stage: "rendering",
      progressPct: 25,
      message: "Rendering frames.",
    });
    await context.throwIfCancelled("rendering frames", {
      force: true,
    });
    throw new Error("expected cancellation");
  });

  const result = await runAttempt({
    sessionClient,
    executor,
  });

  assert.deepEqual(result, {
    status: "cancelled",
  });
  assert.equal(sessionClient.finalizePayloads.length, 1);
  assert.equal(sessionClient.finalizePayloads[0]?.status, "cancelled");
  assert.equal(sessionClient.stageUpdates.length, 1);
  assert.equal(sessionClient.stageUpdates[0]?.stage, "session_ready");
});

test("runExportJobAttempt noops terminal jobs before executing", async (t) => {
  await Promise.all(
    (["completed", "failed"] as const).map(async (status) => {
      await t.test(status, async () => {
        const sessionClient = new FakeSessionClient({
          statusHistory: [
            {
              exportJobId: "job-1",
              status,
              progressPct: 100,
              stage: "finalizing",
            },
          ],
        });
        let executeCalls = 0;
        const executor = createExecutor(async () => {
          executeCalls += 1;
          return {};
        });

        const result = await runAttempt({
          sessionClient,
          executor,
        });

        assert.deepEqual(result, {
          status: "noop",
        });
        assert.equal(executeCalls, 0);
        assert.equal(sessionClient.stageUpdates.length, 0);
        assert.equal(sessionClient.artifactPayloads.length, 0);
        assert.equal(sessionClient.finalizePayloads.length, 0);
      });
    }),
  );
});

test("runExportJobAttempt heartbeats carry artifact activity after artifact registration", async () => {
  const sessionClient = new FakeSessionClient({
    statusHistory: [
      {
        exportJobId: "job-1",
        status: "running",
        progressPct: 0,
        stage: "session_ready",
      },
      {
        exportJobId: "job-1",
        status: "running",
        progressPct: 60,
        stage: "uploading",
      },
      {
        exportJobId: "job-1",
        status: "running",
        progressPct: 60,
        stage: "uploading",
      },
    ],
  });

  const executor = createExecutor(async (context) => {
    await context.setStage({
      stage: "uploading",
      progressPct: 60,
      message: "Uploading artifacts.",
    });
    await context.reportArtifact(
      {
        kind: "export_final",
        storageKey: "exports/job-1/final.mp4",
        mimeType: "video/mp4",
      },
      "Uploaded final export artifact.",
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    return {
      outputStorageKey: "exports/job-1/final.mp4",
    };
  });

  const result = await runAttempt({
    sessionClient,
    executor,
  });

  assert.deepEqual(result, {
    status: "completed",
  });
  assert.ok(
    sessionClient.heartbeatPayloads.some(
      (payload) =>
        payload.message === "Uploaded final export artifact." &&
        payload.details?.artifactKind === "export_final" &&
        payload.details?.artifactStorageKey === "exports/job-1/final.mp4",
    ),
  );
});

test("runExportJobAttempt retries when finalize fails after finalization has started", async () => {
  const sessionClient = new FakeSessionClient({
    finalizeError: new RetryableWorkerError("control plane finalize timeout", {
      code: "CONTROL_PLANE_TIMEOUT",
      stage: "finalizing",
    }),
  });

  const executor = createExecutor(async () => ({
    outputStorageKey: "exports/job-1/final.mp4",
  }));

  const result = await runAttempt({
    sessionClient,
    executor,
    maxAttempts: 3,
  });

  switch (result.status) {
    case "retry":
      assert.ok(result.error instanceof WorkerExecutionError);
      assert.equal(result.error.code, "CONTROL_PLANE_TIMEOUT");
      break;
    default:
      assert.fail(`expected retry outcome, received ${result.status}`);
  }
  assert.equal(sessionClient.finalizePayloads.length, 1);
  assert.equal(sessionClient.finalizePayloads[0]?.status, "completed");
});

test("runExportJobAttempt retries when cancelled finalization fails before success finalization branch", async () => {
  const sessionClient = new FakeSessionClient({
    statusHistory: [
      {
        exportJobId: "job-1",
        status: "running",
        progressPct: 0,
        stage: "session_ready",
      },
      {
        exportJobId: "job-1",
        status: "cancelled",
        progressPct: 20,
        stage: "rendering",
      },
    ],
    finalizeError: new RetryableWorkerError("control plane unavailable", {
      code: "CONTROL_PLANE_UNREACHABLE",
      stage: "finalizing",
    }),
  });

  const executor = createExecutor(async (context) => {
    await context.throwIfCancelled("rendering", {
      force: true,
    });
    throw new WorkerCancelledError("should have cancelled", "rendering");
  });

  const result = await runAttempt({
    sessionClient,
    executor,
    maxAttempts: 3,
  });

  switch (result.status) {
    case "retry":
      assert.ok(result.error instanceof WorkerExecutionError);
      assert.equal(result.error.code, "CONTROL_PLANE_UNREACHABLE");
      break;
    default:
      assert.fail(`expected retry outcome, received ${result.status}`);
  }
  assert.equal(sessionClient.finalizePayloads[0]?.status, "cancelled");
});
