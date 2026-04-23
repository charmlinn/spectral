import assert from "node:assert/strict";
import test from "node:test";

import {
  compareFrameFingerprints,
  compareRenderBenchmarks,
  createRenderParityReport,
  summarizeRenderBenchmark,
  type RenderBenchmarkRecord,
  type RenderFrameFingerprint,
} from "./index";

function createFingerprint(
  frame: number,
  shaSeed: string,
  byteLength = 1024,
): RenderFrameFingerprint {
  return {
    frame,
    sha256: shaSeed.repeat(64).slice(0, 64),
    byteLength,
  };
}

function createBenchmark(
  overrides: Partial<RenderBenchmarkRecord> = {},
): RenderBenchmarkRecord {
  return {
    sessionId: "session-1",
    startedAt: "2026-04-23T00:00:00.000Z",
    finishedAt: "2026-04-23T00:00:01.000Z",
    elapsedMs: 1000,
    frameCount: 30,
    fps: 30,
    marks: [
      {
        label: "page_loaded",
        elapsedMs: 150,
      },
      {
        label: "renderer_warm",
        elapsedMs: 300,
      },
      {
        label: "frames_rendered",
        elapsedMs: 1000,
      },
    ],
    metadata: {},
    ...overrides,
  };
}

test("summarizes and reports fully matching parity inputs", () => {
  const referenceFrames = [
    createFingerprint(0, "a"),
    createFingerprint(15, "b"),
    createFingerprint(29, "c"),
  ];
  const candidateFrames = [
    createFingerprint(0, "a"),
    createFingerprint(15, "b"),
    createFingerprint(29, "c"),
  ];
  const referenceBenchmark = createBenchmark();
  const candidateBenchmark = createBenchmark({
    elapsedMs: 1040,
    fps: 29.5,
    marks: [
      {
        label: "page_loaded",
        elapsedMs: 160,
      },
      {
        label: "renderer_warm",
        elapsedMs: 310,
      },
      {
        label: "frames_rendered",
        elapsedMs: 1040,
      },
    ],
  });

  const summary = summarizeRenderBenchmark(referenceBenchmark);
  assert.equal(summary.status, "pass");
  assert.equal(summary.msPerFrame, 1000 / 30);

  const report = createRenderParityReport({
    fingerprints: {
      reference: referenceFrames,
      candidate: candidateFrames,
    },
    benchmark: {
      reference: referenceBenchmark,
      candidate: candidateBenchmark,
      thresholds: {
        maxElapsedMsDelta: 100,
        minFpsRatio: 0.95,
        maxMarkDeltaMs: 50,
      },
    },
  });

  assert.equal(report.status, "pass");
  assert.equal(report.summary.mismatchCount, 0);
  assert.equal(report.summary.missingCount, 0);
  assert.equal(report.summary.thresholdExceededCount, 0);
  assert.equal(report.fingerprints?.matchedFrameCount, 3);
  assert.equal(report.benchmark?.comparedMetricCount, 7);
});

test("reports partial missing frames", () => {
  const result = compareFrameFingerprints({
    reference: [
      createFingerprint(0, "a"),
      createFingerprint(10, "b"),
      createFingerprint(20, "c"),
    ],
    candidate: [createFingerprint(0, "a"), createFingerprint(20, "c")],
  });

  assert.equal(result.status, "fail");
  assert.equal(result.missingFrameCount, 1);
  assert.equal(result.items[1]?.status, "missing_candidate");
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "FRAME_MISSING_CANDIDATE",
    ),
    true,
  );
});

test("reports fingerprint mismatches", () => {
  const result = compareFrameFingerprints({
    reference: [createFingerprint(0, "a")],
    candidate: [createFingerprint(0, "b", 2048)],
  });

  assert.equal(result.status, "fail");
  assert.equal(result.mismatchedFrameCount, 1);
  assert.equal(result.items[0]?.status, "mismatch");
  assert.equal(result.items[0]?.sha256Matches, false);
  assert.equal(result.items[0]?.byteLengthMatches, false);
});

test("reports benchmark threshold exceedance", () => {
  const result = compareRenderBenchmarks({
    reference: createBenchmark(),
    candidate: createBenchmark({
      elapsedMs: 1400,
      fps: 20,
      marks: [
        {
          label: "page_loaded",
          elapsedMs: 250,
        },
        {
          label: "renderer_warm",
          elapsedMs: 400,
        },
        {
          label: "frames_rendered",
          elapsedMs: 1400,
        },
      ],
    }),
    thresholds: {
      maxElapsedMsDelta: 200,
      minFpsRatio: 0.9,
      maxMarkDeltaMs: 50,
    },
  });

  assert.equal(result.status, "fail");
  assert.equal(result.thresholdExceededCount, 5);
  assert.equal(
    result.metrics.some((metric) => metric.status === "threshold_exceeded"),
    true,
  );
  assert.equal(
    result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "BENCHMARK_THRESHOLD_EXCEEDED",
    ).length,
    5,
  );
});

test("fails when reference benchmark is missing and candidate is valid", () => {
  const candidate = createBenchmark();
  const result = compareRenderBenchmarks({
    reference: null,
    candidate,
  });

  assert.equal(result.status, "fail");
  assert.equal(result.missingCount, 7);
  assert.equal(result.comparedMetricCount, 7);
  assert.equal(result.metrics[0]?.status, "missing_reference");
  assert.equal(
    result.metrics.filter((metric) => metric.status === "missing_reference")
      .length,
    7,
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "BENCHMARK_MISSING_REFERENCE",
    ),
    true,
  );

  const report = createRenderParityReport({
    benchmark: {
      reference: null,
      candidate,
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.summary.missingCount, 7);
  assert.equal(report.summary.benchmarkComparedMetricCount, 7);
});

test("fails when candidate benchmark is missing and reference is valid", () => {
  const reference = createBenchmark();
  const result = compareRenderBenchmarks({
    reference,
    candidate: null,
  });

  assert.equal(result.status, "fail");
  assert.equal(result.missingCount, 7);
  assert.equal(result.comparedMetricCount, 7);
  assert.equal(result.metrics[0]?.status, "missing_candidate");
  assert.equal(
    result.metrics.filter((metric) => metric.status === "missing_candidate")
      .length,
    7,
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "BENCHMARK_MISSING_CANDIDATE",
    ),
    true,
  );
});

test("keeps benchmark comparison skipped when both sides are missing", () => {
  const result = compareRenderBenchmarks({
    reference: null,
    candidate: null,
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.missingCount, 0);
  assert.equal(result.comparedMetricCount, 0);
  assert.equal(result.metrics.length, 0);
  assert.equal(result.diagnostics.length, 0);

  const report = createRenderParityReport({
    benchmark: {
      reference: null,
      candidate: null,
    },
  });

  assert.equal(report.status, "skipped");
  assert.equal(report.summary.missingCount, 0);
  assert.equal(report.summary.benchmarkComparedMetricCount, 0);
});

test("fails when reference benchmark is missing and candidate has no marks", () => {
  const candidate = createBenchmark({
    marks: [],
  });
  const result = compareRenderBenchmarks({
    reference: null,
    candidate,
  });

  assert.equal(result.status, "fail");
  assert.equal(result.missingCount, 4);
  assert.equal(result.comparedMetricCount, 4);
  assert.equal(
    result.metrics.every((metric) => metric.scope === "overall"),
    true,
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "BENCHMARK_MISSING_REFERENCE",
    ),
    true,
  );
});

test("fails when candidate benchmark is missing and reference has no marks", () => {
  const reference = createBenchmark({
    marks: [],
  });
  const result = compareRenderBenchmarks({
    reference,
    candidate: null,
  });

  assert.equal(result.status, "fail");
  assert.equal(result.missingCount, 4);
  assert.equal(result.comparedMetricCount, 4);
  assert.equal(
    result.metrics.every((metric) => metric.scope === "overall"),
    true,
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "BENCHMARK_MISSING_CANDIDATE",
    ),
    true,
  );
});

test("marks empty report input invalid", () => {
  const report = createRenderParityReport({});

  assert.equal(report.status, "invalid");
  assert.equal(report.summary.invalidCount, 1);
  assert.equal(report.diagnostics[0]?.code, "NO_COMPARISON_TARGETS");
});

test("rejects invalid fingerprint input", () => {
  const result = compareFrameFingerprints({
    reference: [
      createFingerprint(0, "a"),
      createFingerprint(0, "b"),
      {
        frame: -1,
        sha256: "bad-hash",
        byteLength: -1,
      } as RenderFrameFingerprint,
    ],
    candidate: [],
  });

  assert.equal(result.status, "invalid");
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "FINGERPRINT_FRAME_DUPLICATE",
    ),
    true,
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "FINGERPRINT_ENTRY_INVALID",
    ),
    true,
  );
});
