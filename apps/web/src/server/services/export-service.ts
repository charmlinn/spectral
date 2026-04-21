import { withTransaction } from "@spectral/db";
import type {
  AudioAnalysisRecord,
  ExportJobDetailRecord,
  ExportJobRecord,
  MediaAssetRecord,
  ProjectDetailRecord,
  ProjectSnapshotRecord,
  RenderArtifactRecord,
} from "@spectral/db";
import type { VideoProject } from "@spectral/project-schema";

import { badRequest, notFound, serviceUnavailable } from "../errors";
import { getAssetResolver, resolveAssetRecordUrl } from "../media";
import { getServerRepositories } from "../repositories";
import { publishExportRenderMessage } from "../queue";

export type RenderPageSurface = {
  width: number;
  height: number;
  dpr: number;
};

export type RenderPageAssetBinding = {
  role: "audio" | "backdrop" | "visualizer-media" | "visualizer-logo";
  assetId: string;
  kind: MediaAssetRecord["kind"];
  status: MediaAssetRecord["status"];
  storageKey: string;
  mimeType: string | null;
  resolvedUrl: string | null;
};

export type RenderPageAudioAnalysisSnapshot = {
  createdAt: string;
  fps: number;
  waveform: {
    durationMs: number;
    sampleRate: number;
    samplesPerPoint: number;
    points: Array<{
      min: number;
      max: number;
    }>;
  };
  spectrumFrames: Array<{
    frame: number;
    timeMs: number;
    values: number[];
  }>;
};

export type RenderPageBootstrapPayload = {
  protocolVersion: "spectral.render-page-bootstrap.v1";
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
  routes: {
    pagePath: string;
    bootstrapPath: string;
    projectEventsPath: string;
    exportEventsPath: string;
  };
};

type RenderAssetBindingSpec = {
  role: RenderPageAssetBinding["role"];
  assetId: string;
};

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

function toFrameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.ceil((durationMs / 1000) * fps));
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

  const spectrumFrames = record.spectrumJson.flatMap((frame): RenderPageAudioAnalysisSnapshot["spectrumFrames"] => {
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

    const values = candidate.values.filter((value): value is number => typeof value === "number");

    return [
      {
        frame: candidate.frame,
        timeMs: candidate.timeMs,
        values,
      },
    ];
  });

  return {
    createdAt: record.createdAt.toISOString(),
    fps,
    waveform: record.waveformJson,
    spectrumFrames,
  };
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

function getExportJobRecord(detail: ExportJobDetailRecord): ExportJobRecord {
  return detail.job;
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

  const job = await withTransaction(repositories, async (transactionRepositories) => {
    const createdJob = await transactionRepositories.exportJobRepository.createQueuedJob({
      projectId: input.projectId,
      snapshotId: exportTarget.snapshot.id,
      format: input.format ?? normalizedProject.export.format,
      width: input.width ?? normalizedProject.export.width,
      height: input.height ?? normalizedProject.export.height,
      fps: input.fps ?? normalizedProject.export.fps,
      durationMs: input.durationMs ?? normalizedProject.timing.durationMs,
      metadata: input.metadata ?? {},
    });

    await transactionRepositories.exportJobRepository.appendEvent(createdJob.id, {
      projectId: input.projectId,
      type: "queued",
      message: "Export job queued.",
      progress: 0,
      payload: {
        snapshotId: exportTarget.snapshot.id,
      },
    });

    return createdJob;
  });

  try {
    await publishExportRenderMessage({
      exportJobId: job.id,
      requestedAt: new Date().toISOString(),
    });
  } catch (error) {
    await repositories.exportJobRepository.appendEvent(job.id, {
      projectId: input.projectId,
      level: "error",
      type: "publish_failed",
      message: "Export job was created but queue publish failed.",
      payload: {
        snapshotId: exportTarget.snapshot.id,
      },
    });

    throw serviceUnavailable("Export job created, but queue publish failed.", {
      exportJobId: job.id,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  return getExportJob(job.id);
}

export async function getExportJob(exportJobId: string) {
  const repositories = getServerRepositories();
  const job = await repositories.exportJobRepository.getJobById(exportJobId);

  if (!job) {
    throw notFound("Export job not found.", {
      exportJobId,
    });
  }

  return job;
}

export async function cancelExportJob(exportJobId: string) {
  const repositories = getServerRepositories();
  const detail = await getExportJob(exportJobId);
  const job = getExportJobRecord(detail);

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return detail;
  }

  await repositories.exportJobRepository.updateJobStatus(exportJobId, {
    status: "cancelled",
    errorCode: "EXPORT_CANCELLED",
    errorMessage: "Export was cancelled by API request.",
  });
  await repositories.exportJobRepository.appendEvent(exportJobId, {
    projectId: job.projectId,
    type: "cancelled",
    message: "Export job cancelled.",
    progress: job.progress,
  });

  return getExportJob(exportJobId);
}

export async function getRenderPageBootstrap(
  exportJobId: string,
): Promise<RenderPageBootstrapPayload> {
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

  const assetBindings = await resolveRenderAssetBindings(snapshot.projectData);
  const analysis = await resolveAudioAnalysis(snapshot.projectData, job.fps);
  const artifacts = await repositories.renderArtifactRepository.listArtifactsByExportJobId(job.id);

  return {
    protocolVersion: "spectral.render-page-bootstrap.v1",
    exportJob: job,
    project: project.project,
    projectSnapshot: snapshot,
    projectDocument: snapshot.projectData,
    surface: {
      width: job.width,
      height: job.height,
      dpr: 1,
    },
    runtime: {
      mode: "deterministic",
      fps: job.fps,
      durationMs: job.durationMs ?? snapshot.projectData.timing.durationMs,
      frameCount: toFrameCount(
        job.durationMs ?? snapshot.projectData.timing.durationMs,
        job.fps,
      ),
      targetElementId: "spectral-render-surface",
    },
    media: {
      analysis: analysis.analysis,
      analysisId: analysis.analysisId,
      assetBindings,
    },
    artifacts,
    routes: {
      pagePath: buildRenderPagePath(job.id),
      bootstrapPath: buildRenderPageBootstrapPath(job.id),
      projectEventsPath: buildProjectEventsPath(job.projectId),
      exportEventsPath: buildExportEventsPath(job.id),
    },
  };
}

export async function getRenderPayload(exportJobId: string) {
  return getRenderPageBootstrap(exportJobId);
}
