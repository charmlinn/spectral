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

export type PresetSummaryDto = {
  id: string;
  slug: string | null;
  name: string;
  enabled: boolean;
  isPremium: boolean;
  recentlyAdded: boolean;
  priority: number;
  popularity: number;
  thumbnailUrl: string | null;
  exampleUrl: string | null;
  importedAt: string;
  updatedAt: string;
};

export type PresetDetailDto = PresetSummaryDto & {
  schemaVersion: number;
  projectData: VideoProject;
  sourcePayload: unknown;
  sourceUpdatedAt: string | null;
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

export type SignedUploadDto = {
  key: string;
  bucket: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export type CreateAssetUploadUrlResponseDto = {
  asset: MediaAssetDto;
  upload: SignedUploadDto;
};

export type CreateAudioAnalysisInput = {
  assetId: string;
  analyzerVersion?: string;
  force?: boolean;
  durationMs?: number;
  sampleRate?: number | null;
  channelCount?: number | null;
  sampleCount?: number | null;
  waveformJson?: unknown;
  spectrumJson?: unknown;
  metadata?: Record<string, unknown>;
};

export type CreateAssetUploadUrlInput = {
  projectId: string;
  kind: "audio" | "image" | "video" | "logo" | "font" | "thumbnail" | "analysis" | "other";
  contentType: string;
  originalFilename: string;
};

export type CompleteAssetInput = {
  assetId: string;
  sha256?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  metadata?: Record<string, unknown>;
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

export async function listProjects(): Promise<ProjectDetailDto[]> {
  return readApiResponse<ProjectDetailDto[]>("/api/projects");
}

export async function listPresets(): Promise<PresetSummaryDto[]> {
  return readApiResponse<PresetSummaryDto[]>("/api/presets");
}

export async function getPreset(presetId: string): Promise<PresetDetailDto> {
  return readApiResponse<PresetDetailDto>(`/api/presets/${presetId}`);
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

export async function createAudioAnalysis(
  input: CreateAudioAnalysisInput,
): Promise<{
  analysis: AudioAnalysisDto;
  reused: boolean;
}> {
  return readApiResponse("/api/audio/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function createAssetUploadUrl(
  input: CreateAssetUploadUrlInput,
): Promise<CreateAssetUploadUrlResponseDto> {
  return readApiResponse<CreateAssetUploadUrlResponseDto>("/api/assets/upload-url", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function completeAsset(
  input: CompleteAssetInput,
): Promise<MediaAssetDto> {
  return readApiResponse<MediaAssetDto>("/api/assets/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function uploadFileToSignedUrl(
  upload: SignedUploadDto,
  file: File,
): Promise<void> {
  const response = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}.`);
  }
}
