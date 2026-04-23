import { performance } from "node:perf_hooks";

import type {
  BenchmarkMark,
  RenderBenchmarkRecorder,
  RenderBenchmarkRecord,
} from "./contracts";
import type { RenderSession } from "@spectral/render-session";

export function createBenchmarkRecorder(
  session: RenderSession,
  initialMetadata: Record<string, unknown> = {},
): RenderBenchmarkRecorder {
  const startedAt = new Date().toISOString();
  const startedPerf = performance.now();
  const marks: BenchmarkMark[] = [];

  return {
    mark(label, metadata) {
      marks.push({
        label,
        elapsedMs: performance.now() - startedPerf,
        metadata,
      });
    },
    finish(metadata): RenderBenchmarkRecord {
      const finishedAt = new Date().toISOString();

      return {
        sessionId: session.sessionId,
        startedAt,
        finishedAt,
        elapsedMs: performance.now() - startedPerf,
        frameCount: session.runtime.frameCount,
        fps: session.runtime.fps,
        marks,
        metadata: {
          ...initialMetadata,
          ...(metadata ?? {}),
        },
      };
    },
  };
}
