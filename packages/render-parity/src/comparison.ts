import type {
  BenchmarkMetricComparison,
  BenchmarkMetricComparisonStatus,
  CompareFrameFingerprintsInput,
  CompareRenderBenchmarksInput,
  CreateRenderParityReportInput,
  FrameFingerprintComparisonItem,
  FrameFingerprintComparisonSummary,
  RenderBenchmarkComparisonSummary,
  RenderBenchmarkSummary,
  RenderBenchmarkSummaryMark,
  RenderFrameFingerprint,
  RenderParityDiagnostic,
  RenderParityDiagnosticCategory,
  RenderParityDiagnosticCode,
  RenderParityReport,
  RenderParityStatus,
  SummarizeRenderBenchmarkInput,
} from "./contracts";

const SHA256_HEX = /^[a-f0-9]{64}$/;

type FingerprintSide = "reference" | "candidate";

type NormalizedFingerprints = {
  byFrame: Map<number, RenderFrameFingerprint>;
  diagnostics: RenderParityDiagnostic[];
};

type ThresholdCheckResult = {
  status: BenchmarkMetricComparisonStatus;
  threshold: Record<string, number> | null;
};

function createDiagnostic(
  code: RenderParityDiagnosticCode,
  category: RenderParityDiagnosticCategory,
  severity: RenderParityDiagnostic["severity"],
  message: string,
  detail: Omit<
    RenderParityDiagnostic,
    "code" | "category" | "severity" | "message"
  > = {},
): RenderParityDiagnostic {
  return {
    code,
    category,
    severity,
    message,
    ...detail,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function compareNumbers(
  referenceValue: number,
  candidateValue: number,
): { delta: number; deltaRatio: number | null } {
  return {
    delta: candidateValue - referenceValue,
    deltaRatio:
      referenceValue === 0 ? null : candidateValue / referenceValue - 1,
  };
}

function normalizeFingerprints(
  input: CompareFrameFingerprintsInput[FingerprintSide],
  side: FingerprintSide,
): NormalizedFingerprints {
  if (input == null) {
    return {
      byFrame: new Map(),
      diagnostics: [],
    };
  }

  if (!Array.isArray(input)) {
    return {
      byFrame: new Map(),
      diagnostics: [
        createDiagnostic(
          "FINGERPRINT_INPUT_INVALID",
          "input",
          "error",
          `Fingerprint ${side} input must be an array.`,
        ),
      ],
    };
  }

  const diagnostics: RenderParityDiagnostic[] = [];
  const byFrame = new Map<number, RenderFrameFingerprint>();

  for (const entry of input) {
    if (!isRecord(entry)) {
      diagnostics.push(
        createDiagnostic(
          "FINGERPRINT_ENTRY_INVALID",
          "input",
          "error",
          `Fingerprint ${side} entry must be an object.`,
        ),
      );
      continue;
    }

    const { frame, sha256, byteLength } = entry;

    if (
      !isNonNegativeInteger(frame) ||
      !isNonEmptyString(sha256) ||
      !SHA256_HEX.test(sha256) ||
      !isNonNegativeInteger(byteLength)
    ) {
      diagnostics.push(
        createDiagnostic(
          "FINGERPRINT_ENTRY_INVALID",
          "input",
          "error",
          `Fingerprint ${side} entry is invalid.`,
          {
            frame: isNonNegativeInteger(frame) ? frame : undefined,
          },
        ),
      );
      continue;
    }

    if (byFrame.has(frame)) {
      diagnostics.push(
        createDiagnostic(
          "FINGERPRINT_FRAME_DUPLICATE",
          "input",
          "error",
          `Fingerprint ${side} contains duplicate frame ${frame}.`,
          {
            frame,
          },
        ),
      );
      continue;
    }

    byFrame.set(frame, {
      frame,
      sha256,
      byteLength,
    });
  }

  return {
    byFrame,
    diagnostics,
  };
}

function buildFingerprintStatus(
  diagnostics: RenderParityDiagnostic[],
  comparedFrameCount: number,
  mismatchedFrameCount: number,
  missingFrameCount: number,
): RenderParityStatus {
  if (diagnostics.some((diagnostic) => diagnostic.category === "input")) {
    return "invalid";
  }
  if (comparedFrameCount === 0) {
    return "skipped";
  }
  if (mismatchedFrameCount > 0 || missingFrameCount > 0) {
    return "fail";
  }
  return "pass";
}

function summarizeSingleBenchmark(
  input: SummarizeRenderBenchmarkInput,
): RenderBenchmarkSummary {
  if (input == null) {
    return {
      status: "skipped",
      sessionId: null,
      elapsedMs: null,
      frameCount: null,
      fps: null,
      msPerFrame: null,
      markCount: 0,
      marks: [],
      diagnostics: [],
    };
  }

  if (!isRecord(input)) {
    return {
      status: "invalid",
      sessionId: null,
      elapsedMs: null,
      frameCount: null,
      fps: null,
      msPerFrame: null,
      markCount: 0,
      marks: [],
      diagnostics: [
        createDiagnostic(
          "BENCHMARK_INPUT_INVALID",
          "input",
          "error",
          "Benchmark input must be an object.",
        ),
      ],
    };
  }

  const diagnostics: RenderParityDiagnostic[] = [];
  const sessionId = isNonEmptyString(input.sessionId) ? input.sessionId : null;
  const elapsedMs = isFiniteNumber(input.elapsedMs) && input.elapsedMs >= 0 ? input.elapsedMs : null;
  const frameCount = isPositiveNumber(input.frameCount) && Number.isInteger(input.frameCount)
    ? input.frameCount
    : null;
  const fps = isPositiveNumber(input.fps) ? input.fps : null;

  if (sessionId === null || elapsedMs === null || frameCount === null || fps === null) {
    diagnostics.push(
      createDiagnostic(
        "BENCHMARK_INPUT_INVALID",
        "input",
        "error",
        "Benchmark input is missing required numeric or string fields.",
      ),
    );
  }

  const marksInput = input.marks;
  const marks: RenderBenchmarkSummaryMark[] = [];
  const seenLabels = new Set<string>();

  if (!Array.isArray(marksInput)) {
    diagnostics.push(
      createDiagnostic(
        "BENCHMARK_INPUT_INVALID",
        "input",
        "error",
        "Benchmark marks must be an array.",
      ),
    );
  } else {
    for (const mark of marksInput) {
      if (!isRecord(mark)) {
        diagnostics.push(
          createDiagnostic(
            "BENCHMARK_MARK_INVALID",
            "input",
            "error",
            "Benchmark mark must be an object.",
          ),
        );
        continue;
      }

      const label = isNonEmptyString(mark.label) ? mark.label : null;
      const markElapsedMs =
        isFiniteNumber(mark.elapsedMs) && mark.elapsedMs >= 0
          ? mark.elapsedMs
          : null;

      if (label === null || markElapsedMs === null) {
        diagnostics.push(
          createDiagnostic(
            "BENCHMARK_MARK_INVALID",
            "input",
            "error",
            "Benchmark mark is invalid.",
            {
              label: label ?? undefined,
            },
          ),
        );
        continue;
      }

      if (seenLabels.has(label)) {
        diagnostics.push(
          createDiagnostic(
            "BENCHMARK_MARK_DUPLICATE",
            "input",
            "error",
            `Benchmark marks contain duplicate label ${label}.`,
            {
              label,
            },
          ),
        );
        continue;
      }

      seenLabels.add(label);
      marks.push({
        label,
        elapsedMs: markElapsedMs,
      });
    }
  }

  const status = diagnostics.length > 0 ? "invalid" : "pass";

  return {
    status,
    sessionId,
    elapsedMs,
    frameCount,
    fps,
    msPerFrame:
      status === "pass" && elapsedMs !== null && frameCount !== null
        ? elapsedMs / frameCount
        : null,
    markCount: marks.length,
    marks,
    diagnostics,
  };
}

function checkLowerIsBetter(
  delta: number,
  deltaRatio: number | null,
  maxDelta: number | undefined,
  maxDeltaRatio: number | undefined,
): ThresholdCheckResult {
  const threshold: Record<string, number> = {};

  if (maxDelta !== undefined) {
    threshold.maxDelta = maxDelta;
  }
  if (maxDeltaRatio !== undefined) {
    threshold.maxDeltaRatio = maxDeltaRatio;
  }

  const exceeded =
    (maxDelta !== undefined && delta > maxDelta) ||
    (maxDeltaRatio !== undefined &&
      deltaRatio !== null &&
      deltaRatio > maxDeltaRatio);

  return {
    status: exceeded ? "threshold_exceeded" : "within_threshold",
    threshold: Object.keys(threshold).length > 0 ? threshold : null,
  };
}

function checkHigherIsBetter(
  referenceValue: number,
  candidateValue: number,
  minRatio: number | undefined,
  maxDrop: number | undefined,
): ThresholdCheckResult {
  const threshold: Record<string, number> = {};

  if (minRatio !== undefined) {
    threshold.minRatio = minRatio;
  }
  if (maxDrop !== undefined) {
    threshold.maxDrop = maxDrop;
  }

  const ratio = referenceValue === 0 ? null : candidateValue / referenceValue;
  const exceeded =
    (minRatio !== undefined && ratio !== null && ratio < minRatio) ||
    (maxDrop !== undefined && referenceValue - candidateValue > maxDrop);

  return {
    status: exceeded ? "threshold_exceeded" : "within_threshold",
    threshold: Object.keys(threshold).length > 0 ? threshold : null,
  };
}

function buildMetric(
  metric: string,
  scope: BenchmarkMetricComparison["scope"],
  label: string | null,
  direction: BenchmarkMetricComparison["direction"],
  referenceValue: number | null,
  candidateValue: number | null,
  status: BenchmarkMetricComparisonStatus,
  threshold: Record<string, number> | null = null,
): BenchmarkMetricComparison {
  if (referenceValue === null || candidateValue === null) {
    return {
      metric,
      scope,
      label,
      status,
      direction,
      referenceValue,
      candidateValue,
      delta: null,
      deltaRatio: null,
      threshold,
    };
  }

  const { delta, deltaRatio } = compareNumbers(referenceValue, candidateValue);

  return {
    metric,
    scope,
    label,
    status,
    direction,
    referenceValue,
    candidateValue,
    delta,
    deltaRatio,
    threshold,
  };
}

function buildMissingBenchmarkMetrics(
  side: FingerprintSide,
  reference: RenderBenchmarkSummary,
  candidate: RenderBenchmarkSummary,
): BenchmarkMetricComparison[] {
  const missingStatus =
    side === "reference" ? "missing_reference" : "missing_candidate";
  const source = side === "reference" ? candidate : reference;
  const metrics: BenchmarkMetricComparison[] = [];

  metrics.push(
    buildMetric(
      "frameCount",
      "overall",
      null,
      "equal",
      reference.frameCount,
      candidate.frameCount,
      missingStatus,
    ),
  );
  metrics.push(
    buildMetric(
      "elapsedMs",
      "overall",
      null,
      "lower_is_better",
      reference.elapsedMs,
      candidate.elapsedMs,
      missingStatus,
    ),
  );
  metrics.push(
    buildMetric(
      "msPerFrame",
      "overall",
      null,
      "lower_is_better",
      reference.msPerFrame,
      candidate.msPerFrame,
      missingStatus,
    ),
  );
  metrics.push(
    buildMetric(
      "fps",
      "overall",
      null,
      "higher_is_better",
      reference.fps,
      candidate.fps,
      missingStatus,
    ),
  );

  for (const mark of source.marks) {
    metrics.push(
      buildMetric(
        `mark:${mark.label}`,
        "mark",
        mark.label,
        "lower_is_better",
        side === "reference" ? null : mark.elapsedMs,
        side === "reference" ? mark.elapsedMs : null,
        missingStatus,
      ),
    );
  }

  return metrics;
}

function buildReportStatus(
  diagnostics: RenderParityDiagnostic[],
  sections: Array<RenderParityStatus | null>,
): RenderParityStatus {
  if (diagnostics.some((diagnostic) => diagnostic.category === "input")) {
    return "invalid";
  }
  if (sections.some((status) => status === "fail")) {
    return "fail";
  }
  if (sections.some((status) => status === "pass")) {
    return "pass";
  }
  return "skipped";
}

export function compareFrameFingerprints(
  input: CompareFrameFingerprintsInput,
): FrameFingerprintComparisonSummary {
  const reference = normalizeFingerprints(input.reference, "reference");
  const candidate = normalizeFingerprints(input.candidate, "candidate");
  const diagnostics = [...reference.diagnostics, ...candidate.diagnostics];
  const frames = [...new Set([...reference.byFrame.keys(), ...candidate.byFrame.keys()])].sort(
    (left, right) => left - right,
  );

  const items: FrameFingerprintComparisonItem[] = [];
  let matchedFrameCount = 0;
  let mismatchedFrameCount = 0;
  let missingFrameCount = 0;

  for (const frame of frames) {
    const referenceEntry = reference.byFrame.get(frame) ?? null;
    const candidateEntry = candidate.byFrame.get(frame) ?? null;

    if (referenceEntry === null) {
      missingFrameCount += 1;
      diagnostics.push(
        createDiagnostic(
          "FRAME_MISSING_REFERENCE",
          "fingerprint",
          "error",
          `Frame ${frame} is missing from the reference fingerprint set.`,
          {
            frame,
          },
        ),
      );
      items.push({
        frame,
        status: "missing_reference",
        reference: null,
        candidate: candidateEntry,
        sha256Matches: null,
        byteLengthMatches: null,
      });
      continue;
    }

    if (candidateEntry === null) {
      missingFrameCount += 1;
      diagnostics.push(
        createDiagnostic(
          "FRAME_MISSING_CANDIDATE",
          "fingerprint",
          "error",
          `Frame ${frame} is missing from the candidate fingerprint set.`,
          {
            frame,
          },
        ),
      );
      items.push({
        frame,
        status: "missing_candidate",
        reference: referenceEntry,
        candidate: null,
        sha256Matches: null,
        byteLengthMatches: null,
      });
      continue;
    }

    const sha256Matches = referenceEntry.sha256 === candidateEntry.sha256;
    const byteLengthMatches =
      referenceEntry.byteLength === candidateEntry.byteLength;

    if (!sha256Matches || !byteLengthMatches) {
      mismatchedFrameCount += 1;
      diagnostics.push(
        createDiagnostic(
          "FRAME_FINGERPRINT_MISMATCH",
          "fingerprint",
          "error",
          `Frame ${frame} fingerprint does not match.`,
          {
            frame,
            referenceValue: referenceEntry.sha256,
            candidateValue: candidateEntry.sha256,
          },
        ),
      );
      items.push({
        frame,
        status: "mismatch",
        reference: referenceEntry,
        candidate: candidateEntry,
        sha256Matches,
        byteLengthMatches,
      });
      continue;
    }

    matchedFrameCount += 1;
    items.push({
      frame,
      status: "match",
      reference: referenceEntry,
      candidate: candidateEntry,
      sha256Matches: true,
      byteLengthMatches: true,
    });
  }

  return {
    status: buildFingerprintStatus(
      diagnostics,
      frames.length,
      mismatchedFrameCount,
      missingFrameCount,
    ),
    referenceCount: reference.byFrame.size,
    candidateCount: candidate.byFrame.size,
    comparedFrameCount: frames.length,
    matchedFrameCount,
    mismatchedFrameCount,
    missingFrameCount,
    items,
    diagnostics,
  };
}

export function summarizeRenderBenchmark(
  input: SummarizeRenderBenchmarkInput,
): RenderBenchmarkSummary {
  return summarizeSingleBenchmark(input);
}

export function compareRenderBenchmarks(
  input: CompareRenderBenchmarksInput,
): RenderBenchmarkComparisonSummary {
  const reference = summarizeSingleBenchmark(input.reference);
  const candidate = summarizeSingleBenchmark(input.candidate);
  const thresholds = input.thresholds ?? {};
  const diagnostics = [...reference.diagnostics, ...candidate.diagnostics];

  if (reference.status === "invalid" || candidate.status === "invalid") {
    return {
      status: "invalid",
      reference,
      candidate,
      thresholds,
      comparedMetricCount: 0,
      thresholdExceededCount: 0,
      mismatchCount: 0,
      missingCount: 0,
      metrics: [],
      diagnostics,
    };
  }

  if (reference.status === "skipped" && candidate.status === "skipped") {
    return {
      status: "skipped",
      reference,
      candidate,
      thresholds,
      comparedMetricCount: 0,
      thresholdExceededCount: 0,
      mismatchCount: 0,
      missingCount: 0,
      metrics: [],
      diagnostics,
    };
  }

  if (reference.status === "skipped") {
    const metrics = buildMissingBenchmarkMetrics(
      "reference",
      reference,
      candidate,
    );

    diagnostics.push(
      createDiagnostic(
        "BENCHMARK_MISSING_REFERENCE",
        "benchmark",
        "error",
        "Reference benchmark is missing.",
      ),
    );

    return {
      status: "fail",
      reference,
      candidate,
      thresholds,
      comparedMetricCount: metrics.length,
      thresholdExceededCount: 0,
      mismatchCount: 0,
      missingCount: metrics.length,
      metrics,
      diagnostics,
    };
  }

  if (candidate.status === "skipped") {
    const metrics = buildMissingBenchmarkMetrics(
      "candidate",
      reference,
      candidate,
    );

    diagnostics.push(
      createDiagnostic(
        "BENCHMARK_MISSING_CANDIDATE",
        "benchmark",
        "error",
        "Candidate benchmark is missing.",
      ),
    );

    return {
      status: "fail",
      reference,
      candidate,
      thresholds,
      comparedMetricCount: metrics.length,
      thresholdExceededCount: 0,
      mismatchCount: 0,
      missingCount: metrics.length,
      metrics,
      diagnostics,
    };
  }

  const metrics: BenchmarkMetricComparison[] = [];
  let thresholdExceededCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  if (reference.frameCount !== null && candidate.frameCount !== null) {
    const frameCountMatch = reference.frameCount === candidate.frameCount;
    metrics.push(
      buildMetric(
        "frameCount",
        "overall",
        null,
        "equal",
        reference.frameCount,
        candidate.frameCount,
        frameCountMatch ? "equal" : "mismatch",
      ),
    );

    if (!frameCountMatch) {
      mismatchCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_FRAME_COUNT_MISMATCH",
          "benchmark",
          "error",
          "Benchmark frameCount does not match.",
          {
            metric: "frameCount",
            referenceValue: reference.frameCount,
            candidateValue: candidate.frameCount,
          },
        ),
      );
    }
  }

  if (reference.elapsedMs !== null && candidate.elapsedMs !== null) {
    const comparison = checkLowerIsBetter(
      candidate.elapsedMs - reference.elapsedMs,
      reference.elapsedMs === 0
        ? null
        : candidate.elapsedMs / reference.elapsedMs - 1,
      thresholds.maxElapsedMsDelta,
      thresholds.maxElapsedMsDeltaRatio,
    );

    metrics.push(
      buildMetric(
        "elapsedMs",
        "overall",
        null,
        "lower_is_better",
        reference.elapsedMs,
        candidate.elapsedMs,
        comparison.status,
        comparison.threshold,
      ),
    );

    if (comparison.status === "threshold_exceeded") {
      thresholdExceededCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_THRESHOLD_EXCEEDED",
          "benchmark",
          "error",
          "Benchmark elapsedMs exceeded threshold.",
          {
            metric: "elapsedMs",
            referenceValue: reference.elapsedMs,
            candidateValue: candidate.elapsedMs,
            threshold: comparison.threshold,
          },
        ),
      );
    }
  }

  if (reference.msPerFrame !== null && candidate.msPerFrame !== null) {
    const comparison = checkLowerIsBetter(
      candidate.msPerFrame - reference.msPerFrame,
      reference.msPerFrame === 0
        ? null
        : candidate.msPerFrame / reference.msPerFrame - 1,
      thresholds.maxMsPerFrameDelta,
      thresholds.maxMsPerFrameDeltaRatio,
    );

    metrics.push(
      buildMetric(
        "msPerFrame",
        "overall",
        null,
        "lower_is_better",
        reference.msPerFrame,
        candidate.msPerFrame,
        comparison.status,
        comparison.threshold,
      ),
    );

    if (comparison.status === "threshold_exceeded") {
      thresholdExceededCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_THRESHOLD_EXCEEDED",
          "benchmark",
          "error",
          "Benchmark msPerFrame exceeded threshold.",
          {
            metric: "msPerFrame",
            referenceValue: reference.msPerFrame,
            candidateValue: candidate.msPerFrame,
            threshold: comparison.threshold,
          },
        ),
      );
    }
  }

  if (reference.fps !== null && candidate.fps !== null) {
    const comparison = checkHigherIsBetter(
      reference.fps,
      candidate.fps,
      thresholds.minFpsRatio,
      thresholds.maxFpsDrop,
    );

    metrics.push(
      buildMetric(
        "fps",
        "overall",
        null,
        "higher_is_better",
        reference.fps,
        candidate.fps,
        comparison.status,
        comparison.threshold,
      ),
    );

    if (comparison.status === "threshold_exceeded") {
      thresholdExceededCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_THRESHOLD_EXCEEDED",
          "benchmark",
          "error",
          "Benchmark fps exceeded threshold.",
          {
            metric: "fps",
            referenceValue: reference.fps,
            candidateValue: candidate.fps,
            threshold: comparison.threshold,
          },
        ),
      );
    }
  }

  const referenceMarks = new Map(
    reference.marks.map((mark) => [mark.label, mark] as const),
  );
  const candidateMarks = new Map(
    candidate.marks.map((mark) => [mark.label, mark] as const),
  );
  const labels = [...new Set([...referenceMarks.keys(), ...candidateMarks.keys()])].sort();

  for (const label of labels) {
    const referenceMark = referenceMarks.get(label) ?? null;
    const candidateMark = candidateMarks.get(label) ?? null;

    if (referenceMark === null) {
      missingCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_MARK_MISSING_REFERENCE",
          "benchmark",
          "error",
          `Benchmark mark ${label} is missing from reference.`,
          {
            label,
            metric: "markElapsedMs",
          },
        ),
      );
      metrics.push(
        buildMetric(
          `mark:${label}`,
          "mark",
          label,
          "lower_is_better",
          null,
          candidateMark?.elapsedMs ?? null,
          "missing_reference",
        ),
      );
      continue;
    }

    if (candidateMark === null) {
      missingCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_MARK_MISSING_CANDIDATE",
          "benchmark",
          "error",
          `Benchmark mark ${label} is missing from candidate.`,
          {
            label,
            metric: "markElapsedMs",
          },
        ),
      );
      metrics.push(
        buildMetric(
          `mark:${label}`,
          "mark",
          label,
          "lower_is_better",
          referenceMark.elapsedMs,
          null,
          "missing_candidate",
        ),
      );
      continue;
    }

    const comparison = checkLowerIsBetter(
      candidateMark.elapsedMs - referenceMark.elapsedMs,
      referenceMark.elapsedMs === 0
        ? null
        : candidateMark.elapsedMs / referenceMark.elapsedMs - 1,
      thresholds.maxMarkDeltaMs,
      thresholds.maxMarkDeltaRatio,
    );

    metrics.push(
      buildMetric(
        `mark:${label}`,
        "mark",
        label,
        "lower_is_better",
        referenceMark.elapsedMs,
        candidateMark.elapsedMs,
        comparison.status,
        comparison.threshold,
      ),
    );

    if (comparison.status === "threshold_exceeded") {
      thresholdExceededCount += 1;
      diagnostics.push(
        createDiagnostic(
          "BENCHMARK_THRESHOLD_EXCEEDED",
          "benchmark",
          "error",
          `Benchmark mark ${label} exceeded threshold.`,
          {
            label,
            metric: "markElapsedMs",
            referenceValue: referenceMark.elapsedMs,
            candidateValue: candidateMark.elapsedMs,
            threshold: comparison.threshold,
          },
        ),
      );
    }
  }

  return {
    status:
      mismatchCount > 0 || missingCount > 0 || thresholdExceededCount > 0
        ? "fail"
        : metrics.length > 0
          ? "pass"
          : "skipped",
    reference,
    candidate,
    thresholds,
    comparedMetricCount: metrics.length,
    thresholdExceededCount,
    mismatchCount,
    missingCount,
    metrics,
    diagnostics,
  };
}

export function createRenderParityReport(
  input: CreateRenderParityReportInput,
): RenderParityReport {
  const fingerprints = input.fingerprints
    ? compareFrameFingerprints({
        reference: input.fingerprints.reference,
        candidate: input.fingerprints.candidate,
      })
    : null;
  const benchmark = input.benchmark
    ? compareRenderBenchmarks(input.benchmark)
    : null;
  const diagnostics = [
    ...(fingerprints?.diagnostics ?? []),
    ...(benchmark?.diagnostics ?? []),
  ];

  if (fingerprints === null && benchmark === null) {
    diagnostics.push(
      createDiagnostic(
        "NO_COMPARISON_TARGETS",
        "input",
        "error",
        "Render parity report requires fingerprints, benchmark, or both.",
      ),
    );
  }

  return {
    status: buildReportStatus(diagnostics, [
      fingerprints?.status ?? null,
      benchmark?.status ?? null,
    ]),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    fingerprints,
    benchmark,
    diagnostics,
    summary: {
      fingerprintComparedFrameCount: fingerprints?.comparedFrameCount ?? 0,
      benchmarkComparedMetricCount: benchmark?.comparedMetricCount ?? 0,
      mismatchCount:
        (fingerprints?.mismatchedFrameCount ?? 0) +
        (benchmark?.mismatchCount ?? 0),
      missingCount:
        (fingerprints?.missingFrameCount ?? 0) + (benchmark?.missingCount ?? 0),
      thresholdExceededCount: benchmark?.thresholdExceededCount ?? 0,
      invalidCount: diagnostics.filter(
        (diagnostic) => diagnostic.category === "input",
      ).length,
      diagnosticCount: diagnostics.length,
    },
    metadata: input.metadata ?? {},
  };
}
