import type { VideoProject } from "@spectral/project-schema";

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export type ProjectRecordDto = {
  id: string;
  name: string;
  description: string | null;
  presetId: string | null;
  activeSnapshotId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ProjectSnapshotDto = {
  id: string;
  projectId: string;
  schemaVersion: number;
  snapshotIndex: number;
  source: string;
  reason: string | null;
  projectData: VideoProject;
  createdAt: string;
};

export type ProjectDetailDto = {
  project: ProjectRecordDto;
  activeSnapshot: ProjectSnapshotDto | null;
  activeProject: VideoProject | null;
};

export type SaveProjectSnapshotResponseDto = {
  snapshot: ProjectSnapshotDto;
  project: ProjectDetailDto;
};

export type ExportJobStatusDto =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ExportJobDto = {
  id: string;
  projectId: string;
  snapshotId: string;
  status: ExportJobStatusDto;
  format: "mp4" | "mov" | "webm";
  width: number;
  height: number;
  fps: number;
  durationMs: number | null;
  attempts: number;
  progress: number;
  outputStorageKey: string | null;
  posterStorageKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
};

export type ExportJobEventDto = {
  id: string;
  jobId: string;
  projectId: string | null;
  level: string;
  type: string;
  message: string | null;
  progress: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ExportJobDetailDto = {
  job: ExportJobDto;
  events: ExportJobEventDto[];
};

export type MediaAssetDto = {
  id: string;
  projectId: string | null;
  kind: string;
  status: string;
  storageKey: string;
  bucket: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sha256: string | null;
  byteSize: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sampleRate: number | null;
  channels: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  resolvedUrl: string | null;
};

export type AudioAnalysisDto = {
  id: string;
  assetId: string;
  analyzerVersion: string;
  durationMs: number;
  sampleRate: number | null;
  channelCount: number | null;
  sampleCount: number | null;
  waveformJson: unknown;
  spectrumJson: unknown;
  waveformStorageKey: string | null;
  spectrumStorageKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error?.message ?? `Request failed with ${response.status}.`;
  } catch {
    return `Request failed with ${response.status}.`;
  }
}

async function readApiResponse<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export function normalizeExportStoreStatus(
  status: ExportJobStatusDto,
): "queued" | "running" | "completed" | "failed" {
  if (status === "cancelled") {
    return "failed";
  }

  return status;
}

export function mapExportJobToSummary(job: ExportJobDto) {
  return {
    id: job.id,
    status: normalizeExportStoreStatus(job.status),
    progress: job.progress,
    updatedAt: job.updatedAt,
  } as const;
}

export function mapExportEventToStoreEvent(event: ExportJobEventDto) {
  return {
    id: event.id,
    jobId: event.jobId,
    type: event.type,
    createdAt: event.createdAt,
    payload: event.payload ?? {},
  } as const;
}

export async function getProject(projectId: string): Promise<ProjectDetailDto> {
  return readApiResponse<ProjectDetailDto>(`/api/projects/${projectId}`);
}

export async function listProjectExports(projectId: string): Promise<ExportJobDto[]> {
  return readApiResponse<ExportJobDto[]>(`/api/projects/${projectId}/exports`);
}

export async function saveProjectSnapshot(
  projectId: string,
  input: {
    projectData: VideoProject;
    source?: string;
    reason?: string | null;
    schemaVersion?: number;
  },
): Promise<SaveProjectSnapshotResponseDto> {
  return readApiResponse<SaveProjectSnapshotResponseDto>(`/api/projects/${projectId}/save`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
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
}): Promise<ExportJobDetailDto> {
  return readApiResponse<ExportJobDetailDto>("/api/exports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function getExportJob(exportJobId: string): Promise<ExportJobDetailDto> {
  return readApiResponse<ExportJobDetailDto>(`/api/exports/${exportJobId}`);
}

export async function getAsset(assetId: string): Promise<MediaAssetDto> {
  return readApiResponse<MediaAssetDto>(`/api/assets/${assetId}`);
}

export async function getAudioAnalysis(analysisId: string): Promise<AudioAnalysisDto> {
  return readApiResponse<AudioAnalysisDto>(`/api/audio/analysis/${analysisId}`);
}

