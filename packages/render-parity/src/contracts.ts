import type { RenderSession } from "@spectral/render-session";

export type RenderParitySample = {
  frame: number;
  timeMs: number;
};

export type RenderFrameFingerprint = {
  frame: number;
  sha256: string;
  byteLength: number;
};

export type BenchmarkMark = {
  label: string;
  elapsedMs: number;
  metadata?: Record<string, unknown>;
};

export type RenderBenchmarkRecord = {
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  frameCount: number;
  fps: number;
  marks: BenchmarkMark[];
  metadata: Record<string, unknown>;
};

export type RenderBenchmarkRecorder = {
  mark(label: string, metadata?: Record<string, unknown>): void;
  finish(metadata?: Record<string, unknown>): RenderBenchmarkRecord;
};

export type SelectRenderSampleFramesInput = {
  session: RenderSession;
  maxSamples?: number;
};
