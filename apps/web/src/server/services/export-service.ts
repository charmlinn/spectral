import { withTransaction } from "@spectral/db";
import type {
  AudioAnalysisRecord,
  ExportJobDetailRecord,
  ExportJobRecord,
  JsonRecord,
  ProjectDetailRecord,
  ProjectSnapshotRecord,
  RenderArtifactRecord,
} from "@spectral/db";
import type { VideoProject } from "@spectral/project-schema";
import type {
  ExportArtifactCreatedPayload,
  ExportJobFinalizePayload,
  ExportJobStage,
  ExportJobStageUpdatePayload,
  RenderSession,
  RenderSessionAssetBinding,
  RenderSessionAudioAnalysisSnapshot,
  RenderSessionFontManifestItem,
  WorkerHeartbeatPayload,
} from "@spectral/render-session";
import { RENDER_SESSION_PROTOCOL_VERSION } from "@spectral/render-session";

import { AppError, badRequest, conflict, notFound, serviceUnavailable } from "../errors";
import { getServerEnv } from "../env";
import { getAssetResolver, resolveAssetRecordUrl } from "../media";
import { enqueueExportRenderJob } from "../queue";
import { getServerRepositories } from "../repositories";

const RENDER_PAGE_BOOTSTRAP_PROTOCOL_VERSION = "spectral.render-page-bootstrap.v1" as const;
const RENDER_PAGE_TARGET_ELEMENT_ID = "spectral-render-surface";
const EXECUTION_METADATA_KEY = "renderExecution";

export type RenderPageSurface = {
  width: number;
  height: number;
  dpr: number;
};

export type RenderPageAssetBinding = RenderSessionAssetBinding;
export type RenderPageAudioAnalysisSnapshot = RenderSessionAudioAnalysisSnapshot;

export type ExportJobExecutionState = {
  sessionId: string;
  stage: ExportJobStage | null;
  workerId: string | null;
  attempt: number | null;
  heartbeatAt: string | null;
  progressPct: number | null;
  message: string | null;
  updatedAt: string | null;
};

export type ExportJobDetailView = ExportJobDetailRecord & {
  execution: ExportJobExecutionState;
};

export type RenderPageBootstrapPayload = {
  protocolVersion: typeof RENDER_PAGE_BOOTSTRAP_PROTOCOL_VERSION;
  session: RenderSession;
  exportJob: ExportJobRecord;
  project: ProjectDetailRecord["project"];
  projectSnapshot: ProjectSnapshotRecord;
  projectDocument: VideoProject;
  surface: RenderPageSurface;
  runtime: {
    mode: "deterministic";
    fps: number;
    durationMs: number;
    frameCount: number;
    targetElementId: string;
  };
  media: {
    analysis: RenderPageAudioAnalysisSnapshot | null;
    analysisId: string | null;
    assetBindings: RenderPageAssetBinding[];
  };
  artifacts: RenderArtifactRecord[];
  routes: RenderSession["routes"]["public"] & {
    internal: RenderSession["routes"]["internal"];
  };
};

type RenderAssetBindingSpec = {
  role: RenderPageAssetBinding["role"];
  assetId: string;
};

type StoredExecutionMetadata = {
  stage?: ExportJobStage | null;
  workerId?: string | null;
  attempt?: number | null;
  heartbeatAt?: string | null;
  progressPct?: number | null;
  message?: string | null;
  updatedAt?: string | null;
};

type ExportContext = {
  job: ExportJobRecord;
  project: ProjectDetailRecord;
  snapshot: ProjectSnapshotRecord;
};

function buildExportStatusPath(exportJobId: string): string {
  return `/api/exports/${exportJobId}`;
}

function buildExportCancelPath(exportJobId: string): string {
  return `/api/exports/${exportJobId}/cancel`;
}

function buildRenderPagePath(exportJobId: string): string {
  return `/render/export/${exportJobId}`;
}

function buildRenderPageBootstrapPath(exportJobId: string): string {
  return `/render/export/${exportJobId}/bootstrap`;
}

function buildProjectEventsPath(projectId: string): string {
  return `/api/events/projects/${projectId}`;
}

function buildExportEventsPath(exportJobId: string): string {
  return `/api/events/exports/${exportJobId}`;
}

function buildInternalSessionPath(exportJobId: string): string {
  return `/api/internal/exports/${exportJobId}/session`;
}

function buildInternalHeartbeatPath(exportJobId: string): string {
  return `/api/internal/exports/${exportJobId}/heartbeat`;
}

function buildInternalStagePath(exportJobId: string): string {
  return `/api/internal/exports/${exportJobId}/stage`;
}

function buildInternalArtifactsPath(exportJobId: string): string {
  return `/api/internal/exports/${exportJobId}/artifacts`;
}

function buildInternalFinalizePath(exportJobId: string): string {
  return `/api/internal/exports/${exportJobId}/finalize`;
}

function buildRenderSessionRoutes(
  exportJobId: string,
  projectId: string,
): RenderSession["routes"] {
  return {
    public: {
      statusPath: buildExportStatusPath(exportJobId),
      pagePath: buildRenderPagePath(exportJobId),
      bootstrapPath: buildRenderPageBootstrapPath(exportJobId),
      cancelPath: buildExportCancelPath(exportJobId),
      exportEventsPath: buildExportEventsPath(exportJobId),
      projectEventsPath: buildProjectEventsPath(projectId),
    },
    internal: {
      sessionPath: buildInternalSessionPath(exportJobId),
      heartbeatPath: buildInternalHeartbeatPath(exportJobId),
      stagePath: buildInternalStagePath(exportJobId),
      artifactsPath: buildInternalArtifactsPath(exportJobId),
      finalizePath: buildInternalFinalizePath(exportJobId),
    },
  };
}

function collectRenderAssetSpecs(project: VideoProject): RenderAssetBindingSpec[] {
  const bindings = new Map<string, RenderAssetBindingSpec>();
  const register = (role: RenderPageAssetBinding["role"], assetId: string | null | undefined) => {
    if (!assetId) {
      return;
    }

    bindings.set(`${role}:${assetId}`, {
      role,
      assetId,
    });
  };

  register("audio", project.audio.assetId ?? project.audio.source?.assetId);
  register("backdrop", project.backdrop.source?.assetId);
  register("visualizer-media", project.visualizer.mediaSource?.assetId);
  register("visualizer-logo", project.visualizer.logoSource?.assetId);

  return [...bindings.values()];
}

function collectRenderFontManifest(
  project: VideoProject,
): RenderSessionFontManifestItem[] {
  const families = new Set<string>();

  if (project.lyrics.style.font) {
    families.add(project.lyrics.style.font);
  }

  for (const layer of project.textLayers) {
    if (layer.style.font) {
      families.add(layer.style.font);
    }
  }

  return [...families].map((family) => ({
    family,
    style: null,
    weight: null,
    fallbackFamilies: [],
    assetId: null,
    storageKey: null,
    resolvedUrl: null,
  }));
}

function toFrameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.ceil((durationMs / 1000) * fps));
}

function buildSampleFrames(frameCount: number): number[] {
  const samples = new Set<number>([
    0,
    Math.max(0, Math.floor((frameCount - 1) / 2)),
    Math.max(0, frameCount - 1),
  ]);

  return [...samples].sort((left, right) => left - right);
}

function toCodecProfile(format: ExportJobRecord["format"]) {
  switch (format) {
    case "mov":
      return {
        videoCodec: "prores",
        audioCodec: "aac",
      };
    case "webm":
      return {
        videoCodec: "vp9",
        audioCodec: "opus",
      };
    case "mp4":
    default:
      return {
        videoCodec: "h264",
        audioCodec: "aac",
      };
  }
}

function normalizeProgressPct(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

function isWaveformShape(value: unknown): value is RenderPageAudioAnalysisSnapshot["waveform"] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    durationMs?: unknown;
    sampleRate?: unknown;
    samplesPerPoint?: unknown;
    points?: unknown;
  };

  return (
    typeof candidate.durationMs === "number" &&
    typeof candidate.sampleRate === "number" &&
    typeof candidate.samplesPerPoint === "number" &&
    Array.isArray(candidate.points)
  );
}

function toAnalysisSnapshot(
  record: AudioAnalysisRecord | null,
  fps: number,
): RenderPageAudioAnalysisSnapshot | null {
  if (!record || !isWaveformShape(record.waveformJson) || !Array.isArray(record.spectrumJson)) {
    return null;
  }

  const spectrumFrames = record.spectrumJson.flatMap(
    (frame): RenderPageAudioAnalysisSnapshot["spectrumFrames"] => {
      if (typeof frame !== "object" || frame === null) {
        return [];
      }

      const candidate = frame as {
        frame?: unknown;
        timeMs?: unknown;
        values?: unknown;
      };

      if (
        typeof candidate.frame !== "number" ||
        typeof candidate.timeMs !== "number" ||
        !Array.isArray(candidate.values)
      ) {
        return [];
      }

      const values = candidate.values.filter(
        (value): value is number => typeof value === "number",
      );

      return [
        {
          frame: candidate.frame,
          timeMs: candidate.timeMs,
          values,
        },
      ];
    },
  );

  return {
    createdAt: record.createdAt.toISOString(),
    fps,
    waveform: record.waveformJson,
    spectrumFrames,
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExecutionMetadata(metadata: JsonRecord): StoredExecutionMetadata {
  const candidate = metadata[EXECUTION_METADATA_KEY];

  if (!isJsonRecord(candidate)) {
    return {};
  }

  return candidate as StoredExecutionMetadata;
}

function mergeJobMetadata(
  baseMetadata: JsonRecord,
  input: {
    metadata?: Record<string, unknown>;
    execution?: StoredExecutionMetadata;
  } = {},
): JsonRecord {
  const nextMetadata: JsonRecord = {
    ...baseMetadata,
    ...(input.metadata ?? {}),
  };

  if (!input.execution) {
    return nextMetadata;
  }

  nextMetadata[EXECUTION_METADATA_KEY] = {
    ...readExecutionMetadata(nextMetadata),
    ...input.execution,
  };

  return nextMetadata;
}

function toExecutionState(job: ExportJobRecord): ExportJobExecutionState {
  const execution = readExecutionMetadata(job.metadata);

  return {
    sessionId: job.id,
    stage: execution.stage ?? null,
    workerId: execution.workerId ?? null,
    attempt: execution.attempt ?? null,
    heartbeatAt: execution.heartbeatAt ?? null,
    progressPct: execution.progressPct ?? null,
    message: execution.message ?? null,
    updatedAt: execution.updatedAt ?? null,
  };
}

function getExportJobRecord(detail: ExportJobDetailRecord): ExportJobRecord {
  return detail.job;
}

function withExecutionState(detail: ExportJobDetailRecord): ExportJobDetailView {
  return {
    ...detail,
    execution: toExecutionState(detail.job),
  };
}

function assertJobIsMutable(job: ExportJobRecord, action: string) {
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    throw badRequest(`Cannot ${action} for a terminal export job.`, {
      exportJobId: job.id,
      status: job.status,
    });
  }
}

async function getSnapshotForExport(projectId: string, snapshotId?: string) {
  const repositories = getServerRepositories();
  const project = await repositories.projectRepository.getProjectWithActiveSnapshot(projectId);

  if (!project) {
    throw notFound("Project not found.", {
      projectId,
    });
  }

  const targetSnapshotId = snapshotId ?? project.activeSnapshot?.id;

  if (!targetSnapshotId) {
    throw badRequest("Project has no active snapshot.", {
      projectId,
    });
  }

  const snapshot = await repositories.projectRepository.getSnapshotById(targetSnapshotId);

  if (!snapshot || snapshot.projectId !== projectId) {
    throw notFound("Project snapshot not found.", {
      projectId,
      snapshotId: targetSnapshotId,
    });
  }

  return {
    project,
    snapshot,
    normalizedProject: snapshot.projectData,
  };
}

async function resolveRenderAssetBindings(
  project: VideoProject,
): Promise<RenderPageAssetBinding[]> {
  const repositories = getServerRepositories();
  const assetResolver = getAssetResolver();
  const bindings = collectRenderAssetSpecs(project);
  const resolvedBindings: RenderPageAssetBinding[] = [];

  for (const binding of bindings) {
    const asset = await repositories.assetRepository.getAssetById(binding.assetId);

    if (!asset) {
      continue;
    }

    const resolvedUrl =
      asset.status === "ready" ? await resolveAssetRecordUrl(asset, assetResolver) : null;

    resolvedBindings.push({
      role: binding.role,
      assetId: asset.id,
      kind: asset.kind,
      status: asset.status,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      resolvedUrl,
    });
  }

  return resolvedBindings;
}

async function resolveAudioAnalysis(
  project: VideoProject,
  fps: number,
): Promise<{
  analysisId: string | null;
  analysis: RenderPageAudioAnalysisSnapshot | null;
}> {
  const repositories = getServerRepositories();
  const analysisRecord = project.audio.analysisId
    ? await repositories.audioAnalysisRepository.getAnalysisById(project.audio.analysisId)
    : project.audio.assetId
      ? await repositories.audioAnalysisRepository.getLatestByAssetId(project.audio.assetId)
      : null;

  return {
    analysisId: analysisRecord?.id ?? project.audio.analysisId ?? null,
    analysis: toAnalysisSnapshot(analysisRecord, fps),
  };
}

async function getExportContext(exportJobId: string): Promise<ExportContext> {
  const repositories = getServerRepositories();
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);
  const project = await repositories.projectRepository.getProjectWithActiveSnapshot(job.projectId);

  if (!project) {
    throw notFound("Project not found for export job.", {
      exportJobId,
      projectId: job.projectId,
    });
  }

  const snapshot = await repositories.projectRepository.getSnapshotById(job.snapshotId);

  if (!snapshot) {
    throw notFound("Export snapshot not found.", {
      exportJobId,
      snapshotId: job.snapshotId,
    });
  }

  return {
    job,
    project,
    snapshot,
  };
}

async function buildRenderSession(context: ExportContext): Promise<RenderSession> {
  const durationMs = context.job.durationMs ?? context.snapshot.projectData.timing.durationMs;
  const frameCount = toFrameCount(durationMs, context.job.fps);
  const sampleFrames = buildSampleFrames(frameCount);
  const analysis = await resolveAudioAnalysis(context.snapshot.projectData, context.job.fps);
  const assetBindings = await resolveRenderAssetBindings(context.snapshot.projectData);
  const codecProfile = toCodecProfile(context.job.format);

  return {
    protocolVersion: RENDER_SESSION_PROTOCOL_VERSION,
    sessionId: context.job.id,
    exportJobId: context.job.id,
    projectId: context.job.projectId,
    snapshotId: context.snapshot.id,
    createdAt: context.job.createdAt.toISOString(),
    runtime: {
      mode: "export",
      width: context.job.width,
      height: context.job.height,
      dpr: 1,
      fps: context.job.fps,
      durationMs,
      frameCount,
      backgroundColor: context.snapshot.projectData.viewport.backgroundColor ?? null,
    },
    project: {
      document: context.snapshot.projectData,
      schemaVersion: context.snapshot.schemaVersion,
    },
    assets: {
      bindings: assetBindings,
      fonts: collectRenderFontManifest(context.snapshot.projectData),
      audioAnalysis:
        analysis.analysisId || analysis.analysis
          ? {
              analysisId: analysis.analysisId,
              snapshot: analysis.analysis,
            }
          : null,
    },
    output: {
      format: context.job.format,
      videoCodec: codecProfile.videoCodec,
      audioCodec: codecProfile.audioCodec,
      posterFrame: sampleFrames.at(1) ?? sampleFrames[0] ?? null,
      thumbnailFrames: sampleFrames,
    },
    diagnostics: {
      parityPresetKey:
        typeof context.snapshot.projectData.source.legacyPresetId === "string"
          ? context.snapshot.projectData.source.legacyPresetId
          : null,
      sampleFrames,
      enableFrameHashes: false,
    },
    routes: buildRenderSessionRoutes(context.job.id, context.job.projectId),
  };
}

async function appendStructuredEvent(input: {
  exportJobId: string;
  projectId: string;
  type:
    | "queued"
    | "stage_changed"
    | "heartbeat"
    | "artifact_created"
    | "completed"
    | "failed"
    | "cancelled"
    | "retry_scheduled"
    | "progress";
  stage?: ExportJobStage | null;
  progressPct?: number | null;
  message?: string | null;
  level?: "info" | "warning" | "error";
  payload?: Record<string, unknown>;
}) {
  const repositories = getServerRepositories();

  await repositories.exportJobRepository.appendEvent(input.exportJobId, {
    projectId: input.projectId,
    type: input.type,
    level: input.level,
    message: input.message ?? null,
    progress: normalizeProgressPct(input.progressPct) ?? null,
    payload: {
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.payload ?? {}),
    },
  });
}

async function getOrCreateRenderArtifact(input: {
  exportJobId: string;
  projectId: string;
  payload: ExportArtifactCreatedPayload["artifact"];
}): Promise<{
  artifact: RenderArtifactRecord;
  created: boolean;
}> {
  const repositories = getServerRepositories();
  const existingArtifact =
    await repositories.renderArtifactRepository.getArtifactByStorageKey(input.payload.storageKey);

  if (existingArtifact) {
    if (
      existingArtifact.exportJobId !== input.exportJobId ||
      existingArtifact.projectId !== input.projectId
    ) {
      throw conflict("Render artifact storage key is already registered to another export job.", {
        exportJobId: input.exportJobId,
        storageKey: input.payload.storageKey,
        existingArtifactId: existingArtifact.id,
        existingExportJobId: existingArtifact.exportJobId,
      });
    }

    if (existingArtifact.kind !== input.payload.kind) {
      throw conflict("Render artifact storage key is already registered with another kind.", {
        exportJobId: input.exportJobId,
        storageKey: input.payload.storageKey,
        existingArtifactId: existingArtifact.id,
        existingKind: existingArtifact.kind,
        requestedKind: input.payload.kind,
      });
    }

    return {
      artifact: existingArtifact,
      created: false,
    };
  }

  let artifact: RenderArtifactRecord;

  try {
    artifact = await repositories.renderArtifactRepository.createArtifact({
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
      await repositories.renderArtifactRepository.getArtifactByStorageKey(input.payload.storageKey);

    if (!concurrentArtifact) {
      throw error;
    }

    if (
      concurrentArtifact.exportJobId !== input.exportJobId ||
      concurrentArtifact.projectId !== input.projectId
    ) {
      throw conflict("Render artifact storage key is already registered to another export job.", {
        exportJobId: input.exportJobId,
        storageKey: input.payload.storageKey,
        existingArtifactId: concurrentArtifact.id,
        existingExportJobId: concurrentArtifact.exportJobId,
      });
    }

    if (concurrentArtifact.kind !== input.payload.kind) {
      throw conflict("Render artifact storage key is already registered with another kind.", {
        exportJobId: input.exportJobId,
        storageKey: input.payload.storageKey,
        existingArtifactId: concurrentArtifact.id,
        existingKind: concurrentArtifact.kind,
        requestedKind: input.payload.kind,
      });
    }

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

export function assertInternalExportRequest(request: Request) {
  const env = getServerEnv();

  if (!env.internalExportsToken) {
    throw serviceUnavailable(
      "Internal exports API is disabled because INTERNAL_EXPORTS_TOKEN is not configured.",
    );
  }

  const authorization = request.headers.get("authorization");
  const bearerToken =
    authorization && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;
  const internalToken = bearerToken ?? request.headers.get("x-spectral-internal-token");

  if (internalToken !== env.internalExportsToken) {
    throw new AppError("Unauthorized internal export request.", {
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  }
}

export async function createExportJob(input: {
  projectId: string;
  snapshotId?: string;
  format?: "mp4" | "mov" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const repositories = getServerRepositories();
  const exportTarget = await getSnapshotForExport(input.projectId, input.snapshotId);
  const normalizedProject = exportTarget.normalizedProject;
  const queuedAt = new Date().toISOString();

  const job = await withTransaction(repositories, async (transactionRepositories) => {
    const createdJob = await transactionRepositories.exportJobRepository.createQueuedJob({
      projectId: input.projectId,
      snapshotId: exportTarget.snapshot.id,
      format: input.format ?? normalizedProject.export.format,
      width: input.width ?? normalizedProject.export.width,
      height: input.height ?? normalizedProject.export.height,
      fps: input.fps ?? normalizedProject.export.fps,
      durationMs: input.durationMs ?? normalizedProject.timing.durationMs,
      metadata: mergeJobMetadata(input.metadata ?? {}, {
        execution: {
          stage: "session_ready",
          progressPct: 0,
          message: "Export job queued.",
          updatedAt: queuedAt,
        },
      }),
    });

    await transactionRepositories.exportJobRepository.appendEvent(createdJob.id, {
      projectId: input.projectId,
      type: "queued",
      message: "Export job queued.",
      progress: 0,
      payload: {
        stage: "session_ready",
        snapshotId: exportTarget.snapshot.id,
      },
    });

    return createdJob;
  });

  try {
    await enqueueExportRenderJob({
      exportJobId: job.id,
      requestedAt: new Date().toISOString(),
    });
  } catch (error) {
    await repositories.exportJobRepository.appendEvent(job.id, {
      projectId: input.projectId,
      level: "error",
      type: "enqueue_failed",
      message: "Export job was created but queue enqueue failed.",
      payload: {
        snapshotId: exportTarget.snapshot.id,
      },
    });

    throw serviceUnavailable("Export job created, but queue enqueue failed.", {
      exportJobId: job.id,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  return getExportJob(job.id);
}

export async function getExportJob(exportJobId: string): Promise<ExportJobDetailView> {
  const repositories = getServerRepositories();
  const job = await repositories.exportJobRepository.getJobById(exportJobId);

  if (!job) {
    throw notFound("Export job not found.", {
      exportJobId,
    });
  }

  return withExecutionState(job);
}

export async function cancelExportJob(exportJobId: string) {
  const repositories = getServerRepositories();
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return detail;
  }

  const cancelledAt = new Date().toISOString();
  await repositories.exportJobRepository.updateJobStatus(exportJobId, {
    status: "cancelled",
    errorCode: "EXPORT_CANCELLED",
    errorMessage: "Export was cancelled by API request.",
    metadata: mergeJobMetadata(job.metadata, {
      execution: {
        stage: "finalizing",
        progressPct: normalizeProgressPct(job.progress) ?? 0,
        message: "Export job cancelled.",
        updatedAt: cancelledAt,
      },
    }),
  });
  await appendStructuredEvent({
    exportJobId,
    projectId: job.projectId,
    type: "cancelled",
    stage: "finalizing",
    progressPct: job.progress,
    message: "Export job cancelled.",
  });

  return getExportJob(exportJobId);
}

export async function getRenderSession(exportJobId: string): Promise<RenderSession> {
  const context = await getExportContext(exportJobId);
  return buildRenderSession(context);
}

export async function recordExportHeartbeat(
  exportJobId: string,
  input: WorkerHeartbeatPayload,
) {
  const repositories = getServerRepositories();
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);
  assertJobIsMutable(job, "record a worker heartbeat");

  const normalizedProgress = normalizeProgressPct(input.progressPct);
  const status = job.status === "queued" ? "running" : job.status;

  await repositories.exportJobRepository.updateJobStatus(exportJobId, {
    status,
    progress: normalizedProgress ?? undefined,
    attempts: Math.max(job.attempts, input.attempt),
    metadata: mergeJobMetadata(job.metadata, {
      execution: {
        workerId: input.workerId,
        attempt: input.attempt,
        heartbeatAt: input.heartbeatAt,
        updatedAt: input.heartbeatAt,
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(normalizedProgress !== undefined ? { progressPct: normalizedProgress } : {}),
      },
    }),
  });

  await appendStructuredEvent({
    exportJobId,
    projectId: job.projectId,
    type: "heartbeat",
    stage: input.stage ?? detail.execution.stage,
    progressPct: normalizedProgress ?? detail.execution.progressPct,
    message: input.message ?? "Worker heartbeat received.",
    payload: {
      workerId: input.workerId,
      attempt: input.attempt,
      heartbeatAt: input.heartbeatAt,
      details: input.details ?? {},
    },
  });

  return getExportJob(exportJobId);
}

export async function updateExportJobStage(
  exportJobId: string,
  input: ExportJobStageUpdatePayload,
) {
  const repositories = getServerRepositories();
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);
  assertJobIsMutable(job, "update the export stage");

  const normalizedProgress = normalizeProgressPct(input.progressPct);
  const now = new Date().toISOString();

  await repositories.exportJobRepository.updateJobStatus(exportJobId, {
    status: job.status === "queued" ? "running" : job.status,
    progress: normalizedProgress ?? undefined,
    attempts: Math.max(job.attempts, input.attempt),
    metadata: mergeJobMetadata(job.metadata, {
      execution: {
        stage: input.stage,
        workerId: input.workerId,
        attempt: input.attempt,
        heartbeatAt: now,
        updatedAt: now,
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(normalizedProgress !== undefined ? { progressPct: normalizedProgress } : {}),
      },
    }),
  });

  await appendStructuredEvent({
    exportJobId,
    projectId: job.projectId,
    type: "stage_changed",
    stage: input.stage,
    progressPct: normalizedProgress ?? detail.execution.progressPct,
    message: input.message ?? `Export stage changed to ${input.stage}.`,
    payload: {
      workerId: input.workerId,
      attempt: input.attempt,
      details: input.details ?? {},
    },
  });

  return getExportJob(exportJobId);
}

export async function createExportArtifact(
  exportJobId: string,
  input: ExportArtifactCreatedPayload,
) {
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);
  assertJobIsMutable(job, "register a render artifact");

  const { artifact, created } = await getOrCreateRenderArtifact({
    exportJobId,
    projectId: job.projectId,
    payload: input.artifact,
  });

  if (created) {
    await appendStructuredEvent({
      exportJobId,
      projectId: job.projectId,
      type: "artifact_created",
      stage: detail.execution.stage,
      progressPct: detail.execution.progressPct,
      message: input.message ?? `Artifact ${artifact.kind} registered.`,
      payload: {
        workerId: input.workerId,
        attempt: input.attempt,
        artifactId: artifact.id,
        artifactKind: artifact.kind,
        storageKey: artifact.storageKey,
      },
    });
  }

  return {
    artifact,
    job: await getExportJob(exportJobId),
  };
}

export async function finalizeExportJob(
  exportJobId: string,
  input: ExportJobFinalizePayload,
) {
  const repositories = getServerRepositories();
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);

  if (job.status === input.status) {
    return detail;
  }

  assertJobIsMutable(job, "finalize the export job");

  const normalizedProgress =
    normalizeProgressPct(input.progressPct) ??
    (input.status === "completed" ? 100 : normalizeProgressPct(job.progress) ?? 0);
  const finalizedAt = new Date().toISOString();
  const message =
    input.message ??
    (input.status === "completed"
      ? "Export job completed."
      : input.status === "failed"
        ? input.errorMessage ?? "Export job failed."
        : "Export job cancelled.");

  await repositories.exportJobRepository.updateJobStatus(exportJobId, {
    status: input.status,
    progress: normalizedProgress,
    attempts: Math.max(job.attempts, input.attempt),
    outputStorageKey: input.outputStorageKey ?? undefined,
    posterStorageKey: input.posterStorageKey ?? undefined,
    errorCode: input.errorCode ?? undefined,
    errorMessage: input.errorMessage ?? undefined,
    metadata: mergeJobMetadata(job.metadata, {
      metadata: input.metadata,
      execution: {
        stage: "finalizing",
        workerId: input.workerId,
        attempt: input.attempt,
        heartbeatAt: finalizedAt,
        updatedAt: finalizedAt,
        progressPct: normalizedProgress,
        message,
      },
    }),
  });

  await appendStructuredEvent({
    exportJobId,
    projectId: job.projectId,
    type: input.status,
    stage: "finalizing",
    progressPct: normalizedProgress,
    message,
    level: input.status === "failed" ? "error" : "info",
    payload: {
      workerId: input.workerId,
      attempt: input.attempt,
      outputStorageKey: input.outputStorageKey ?? null,
      posterStorageKey: input.posterStorageKey ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });

  return getExportJob(exportJobId);
}

export async function getRenderPageBootstrap(
  exportJobId: string,
): Promise<RenderPageBootstrapPayload> {
  const repositories = getServerRepositories();
  const context = await getExportContext(exportJobId);
  const session = await buildRenderSession(context);
  const artifacts = await repositories.renderArtifactRepository.listArtifactsByExportJobId(
    context.job.id,
  );

  return {
    protocolVersion: RENDER_PAGE_BOOTSTRAP_PROTOCOL_VERSION,
    session,
    exportJob: context.job,
    project: context.project.project,
    projectSnapshot: context.snapshot,
    projectDocument: context.snapshot.projectData,
    surface: {
      width: session.runtime.width,
      height: session.runtime.height,
      dpr: session.runtime.dpr,
    },
    runtime: {
      mode: "deterministic",
      fps: session.runtime.fps,
      durationMs: session.runtime.durationMs,
      frameCount: session.runtime.frameCount,
      targetElementId: RENDER_PAGE_TARGET_ELEMENT_ID,
    },
    media: {
      analysis: session.assets.audioAnalysis?.snapshot ?? null,
      analysisId: session.assets.audioAnalysis?.analysisId ?? null,
      assetBindings: session.assets.bindings,
    },
    artifacts,
    routes: {
      ...session.routes.public,
      internal: session.routes.internal,
    },
  };
}

export async function getRenderPayload(exportJobId: string) {
  return getRenderPageBootstrap(exportJobId);
}
