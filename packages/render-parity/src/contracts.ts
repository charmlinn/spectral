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

export type RenderParityStatus = "pass" | "fail" | "invalid" | "skipped";

export type RenderParitySeverity = "info" | "warning" | "error";

export type RenderParityDiagnosticCode =
  | "NO_COMPARISON_TARGETS"
  | "FINGERPRINT_INPUT_INVALID"
  | "FINGERPRINT_ENTRY_INVALID"
  | "FINGERPRINT_FRAME_DUPLICATE"
  | "FRAME_MISSING_REFERENCE"
  | "FRAME_MISSING_CANDIDATE"
  | "FRAME_FINGERPRINT_MISMATCH"
  | "BENCHMARK_INPUT_INVALID"
  | "BENCHMARK_MISSING_REFERENCE"
  | "BENCHMARK_MISSING_CANDIDATE"
  | "BENCHMARK_MARK_DUPLICATE"
  | "BENCHMARK_MARK_INVALID"
  | "BENCHMARK_FRAME_COUNT_MISMATCH"
  | "BENCHMARK_MARK_MISSING_REFERENCE"
  | "BENCHMARK_MARK_MISSING_CANDIDATE"
  | "BENCHMARK_THRESHOLD_EXCEEDED";

export type RenderParityDiagnosticCategory =
  | "input"
  | "fingerprint"
  | "benchmark";

export type RenderParityDiagnostic = {
  code: RenderParityDiagnosticCode;
  category: RenderParityDiagnosticCategory;
  severity: RenderParitySeverity;
  message: string;
  frame?: number;
  label?: string;
  metric?: string;
  referenceValue?: number | string | null;
  candidateValue?: number | string | null;
  threshold?: number | Record<string, number> | null;
};

export type FrameFingerprintComparisonStatus =
  | "match"
  | "mismatch"
  | "missing_reference"
  | "missing_candidate";

export type FrameFingerprintComparisonItem = {
  frame: number;
  status: FrameFingerprintComparisonStatus;
  reference: RenderFrameFingerprint | null;
  candidate: RenderFrameFingerprint | null;
  sha256Matches: boolean | null;
  byteLengthMatches: boolean | null;
};

export type FrameFingerprintComparisonSummary = {
  status: RenderParityStatus;
  referenceCount: number;
  candidateCount: number;
  comparedFrameCount: number;
  matchedFrameCount: number;
  mismatchedFrameCount: number;
  missingFrameCount: number;
  items: FrameFingerprintComparisonItem[];
  diagnostics: RenderParityDiagnostic[];
};

export type CompareFrameFingerprintsInput = {
  reference: readonly RenderFrameFingerprint[] | null | undefined;
  candidate: readonly RenderFrameFingerprint[] | null | undefined;
};

export type RenderBenchmarkSummaryMark = {
  label: string;
  elapsedMs: number;
};

export type RenderBenchmarkSummary = {
  status: RenderParityStatus;
  sessionId: string | null;
  elapsedMs: number | null;
  frameCount: number | null;
  fps: number | null;
  msPerFrame: number | null;
  markCount: number;
  marks: RenderBenchmarkSummaryMark[];
  diagnostics: RenderParityDiagnostic[];
};

export type SummarizeRenderBenchmarkInput =
  | RenderBenchmarkRecord
  | null
  | undefined;

export type RenderBenchmarkThresholds = {
  maxElapsedMsDelta?: number;
  maxElapsedMsDeltaRatio?: number;
  maxMsPerFrameDelta?: number;
  maxMsPerFrameDeltaRatio?: number;
  minFpsRatio?: number;
  maxFpsDrop?: number;
  maxMarkDeltaMs?: number;
  maxMarkDeltaRatio?: number;
};

export type BenchmarkMetricComparisonStatus =
  | "equal"
  | "within_threshold"
  | "threshold_exceeded"
  | "mismatch"
  | "missing_reference"
  | "missing_candidate";

export type BenchmarkMetricDirection =
  | "lower_is_better"
  | "higher_is_better"
  | "equal";

export type BenchmarkMetricComparison = {
  metric: string;
  scope: "overall" | "mark";
  label: string | null;
  status: BenchmarkMetricComparisonStatus;
  direction: BenchmarkMetricDirection;
  referenceValue: number | null;
  candidateValue: number | null;
  delta: number | null;
  deltaRatio: number | null;
  threshold: Record<string, number> | null;
};

export type RenderBenchmarkComparisonSummary = {
  status: RenderParityStatus;
  reference: RenderBenchmarkSummary;
  candidate: RenderBenchmarkSummary;
  thresholds: RenderBenchmarkThresholds;
  comparedMetricCount: number;
  thresholdExceededCount: number;
  mismatchCount: number;
  missingCount: number;
  metrics: BenchmarkMetricComparison[];
  diagnostics: RenderParityDiagnostic[];
};

export type CompareRenderBenchmarksInput = {
  reference: RenderBenchmarkRecord | null | undefined;
  candidate: RenderBenchmarkRecord | null | undefined;
  thresholds?: RenderBenchmarkThresholds;
};

export type RenderParityReportSummary = {
  fingerprintComparedFrameCount: number;
  benchmarkComparedMetricCount: number;
  mismatchCount: number;
  missingCount: number;
  thresholdExceededCount: number;
  invalidCount: number;
  diagnosticCount: number;
};

export type RenderParityReport = {
  status: RenderParityStatus;
  generatedAt: string;
  fingerprints: FrameFingerprintComparisonSummary | null;
  benchmark: RenderBenchmarkComparisonSummary | null;
  diagnostics: RenderParityDiagnostic[];
  summary: RenderParityReportSummary;
  metadata: Record<string, unknown>;
};

export type CreateRenderParityReportInput = {
  fingerprints?: Partial<CompareFrameFingerprintsInput>;
  benchmark?: CompareRenderBenchmarksInput;
  generatedAt?: string;
  metadata?: Record<string, unknown>;
};
