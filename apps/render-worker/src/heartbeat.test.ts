import assert from "node:assert/strict";
import test from "node:test";

import type { RenderSession, WorkerHeartbeatPayload } from "@spectral/render-session";

import { HeartbeatReporter } from "./heartbeat";
import type { RenderWorkerSessionClient } from "./session-client";

function createSession(exportJobId = "job-heartbeat"): RenderSession {
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

function createSessionClient(recordedHeartbeats: WorkerHeartbeatPayload[]): RenderWorkerSessionClient {
  return {
    async fetchSession() {
      throw new Error("not implemented");
    },
    async getJobSnapshot() {
      throw new Error("not implemented");
    },
    async reportHeartbeat(_session, payload) {
      recordedHeartbeats.push(payload);
    },
    async updateStage() {
      throw new Error("not implemented");
    },
    async createArtifact() {
      throw new Error("not implemented");
    },
    async finalize() {
      throw new Error("not implemented");
    },
    resolveUrl(routePath) {
      return `https://example.test${routePath}`;
    },
  };
}

test("HeartbeatReporter flushes latest activity even when work is active", async () => {
  const recordedHeartbeats: WorkerHeartbeatPayload[] = [];
  const reporter = new HeartbeatReporter({
    session: createSession(),
    sessionClient: createSessionClient(recordedHeartbeats),
    workerId: "worker-1",
    attempt: 1,
    intervalMs: 10,
    initialState: {
      stage: "rendering",
      progressPct: 35,
      message: "Rendering started.",
      details: {
        phase: "initial",
      },
    },
  });

  reporter.noteActivity(
    {
      stage: "uploading",
      progressPct: 82,
      message: "Uploaded final export artifact.",
      details: {
        artifactKind: "export_final",
        artifactStorageKey: "exports/job-heartbeat/final.mp4",
      },
    },
    {
      activeSignal: true,
    },
  );

  await reporter.flush();
  await reporter.stop();

  assert.equal(recordedHeartbeats.length, 1);
  assert.equal(recordedHeartbeats[0]?.stage, "uploading");
  assert.equal(recordedHeartbeats[0]?.message, "Uploaded final export artifact.");
  assert.deepEqual(recordedHeartbeats[0]?.details, {
    artifactKind: "export_final",
    artifactStorageKey: "exports/job-heartbeat/final.mp4",
  });
});
