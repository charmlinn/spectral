import type { LegacySpecterrPreset, VideoProject } from "@spectral/project-schema";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue | undefined;
};
export type JsonRecord = Record<string, unknown>;

export type MediaAssetKind =
  | "audio"
  | "image"
  | "video"
  | "logo"
  | "font"
  | "thumbnail"
  | "analysis"
  | "other";

export type MediaAssetStatus = "pending" | "ready" | "failed" | "deleted";
export type ExportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ExportFormat = "mp4" | "mov" | "webm";
export type EventLevel = "info" | "warning" | "error";
export type RenderArtifactKind =
  | "waveform"
  | "spectrum"
  | "thumbnail"
  | "export_chunk"
  | "export_final"
  | "poster"
  | "preview_frame"
  | "other";

export type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  presetId: string | null;
  activeSnapshotId: string | null;
  metadata: JsonRecord;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ProjectSnapshotRecord = {
  id: string;
  projectId: string;
  schemaVersion: number;
  snapshotIndex: number;
  source: string;
  reason: string | null;
  projectData: VideoProject;
  createdAt: Date;
};

export type ProjectDetailRecord = {
  project: ProjectRecord;
  activeSnapshot: ProjectSnapshotRecord | null;
  activeProject: VideoProject | null;
};

export type PresetSummaryRecord = {
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
  importedAt: Date;
  updatedAt: Date;
};

export type PresetRecord = PresetSummaryRecord & {
  schemaVersion: number;
  projectData: VideoProject;
  sourcePayload: LegacySpecterrPreset;
  sourceUpdatedAt: Date | null;
};

export type MediaAssetRecord = {
  id: string;
  projectId: string | null;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  storageKey: string;
  bucket: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sha256: string | null;
  byteSize: bigint | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sampleRate: number | null;
  channels: number | null;
  metadata: JsonRecord;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type AudioAnalysisRecord = {
  id: string;
  assetId: string;
  analyzerVersion: string;
  durationMs: number;
  sampleRate: number | null;
  channelCount: number | null;
  sampleCount: number | null;
  waveformJson: JsonValue | null;
  spectrumJson: JsonValue | null;
  waveformStorageKey: string | null;
  spectrumStorageKey: string | null;
  metadata: JsonRecord;
  createdAt: Date;
  updatedAt: Date;
};

export type ExportJobRecord = {
  id: string;
  projectId: string;
  snapshotId: string;
  status: ExportJobStatus;
  format: ExportFormat;
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
  metadata: JsonRecord;
  createdAt: Date;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  updatedAt: Date;
};

export type ExportJobEventRecord = {
  id: bigint;
  jobId: string;
  projectId: string | null;
  level: EventLevel;
  type: string;
  message: string | null;
  progress: number | null;
  payload: JsonRecord;
  createdAt: Date;
};

export type ExportJobDetailRecord = {
  job: ExportJobRecord;
  events: ExportJobEventRecord[];
};

export type RenderArtifactRecord = {
  id: string;
  projectId: string | null;
  exportJobId: string | null;
  kind: RenderArtifactKind;
  storageKey: string;
  mimeType: string | null;
  byteSize: bigint | null;
  metadata: JsonRecord;
  createdAt: Date;
};

export type CreateProjectInput = {
  id?: string;
  name: string;
  description?: string | null;
  presetId?: string | null;
  metadata?: JsonRecord;
};

export type UpdateProjectMetadataInput = {
  name?: string;
  description?: string | null;
  metadata?: JsonRecord;
  presetId?: string | null;
};

export type SaveProjectSnapshotInput = {
  projectId: string;
  projectData: VideoProject | Record<string, unknown>;
  schemaVersion?: number;
  source?: string;
  reason?: string | null;
};

export type UpsertPresetInput = {
  legacyPreset: LegacySpecterrPreset;
};

export type ImportLegacyPresetsResult = {
  importedCount: number;
  presets: PresetRecord[];
};

export type CreateMediaAssetInput = {
  id?: string;
  projectId?: string | null;
  kind: MediaAssetKind;
  storageKey: string;
  bucket?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sha256?: string | null;
  byteSize?: bigint | number | null;
  metadata?: JsonRecord;
};

export type CompleteMediaAssetInput = {
  sha256?: string | null;
  byteSize?: bigint | number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  metadata?: JsonRecord;
};

export type UpsertAudioAnalysisInput = {
  assetId: string;
  analyzerVersion: string;
  durationMs: number;
  sampleRate?: number | null;
  channelCount?: number | null;
  sampleCount?: number | null;
  waveformJson?: JsonValue | null;
  spectrumJson?: JsonValue | null;
  waveformStorageKey?: string | null;
  spectrumStorageKey?: string | null;
  metadata?: JsonRecord;
};

export type CreateExportJobInput = {
  id?: string;
  projectId: string;
  snapshotId: string;
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  durationMs?: number | null;
  metadata?: JsonRecord;
};

export type AppendExportJobEventInput = {
  projectId?: string | null;
  level?: EventLevel;
  type: string;
  message?: string | null;
  progress?: number | null;
  payload?: JsonRecord;
};

export type UpdateExportJobStatusInput = {
  status: ExportJobStatus;
  progress?: number;
  outputStorageKey?: string | null;
  posterStorageKey?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attempts?: number;
  metadata?: JsonRecord;
};

export type ExportEventCursorInput = {
  afterEventId?: bigint;
  limit?: number;
};

export type CreateRenderArtifactInput = {
  id?: string;
  projectId?: string | null;
  exportJobId?: string | null;
  kind: RenderArtifactKind;
  storageKey: string;
  mimeType?: string | null;
  byteSize?: bigint | number | null;
  metadata?: JsonRecord;
};

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  listProjects(): Promise<ProjectDetailRecord[]>;
  getProjectById(projectId: string): Promise<ProjectDetailRecord | null>;
  updateProjectMetadata(
    projectId: string,
    input: UpdateProjectMetadataInput,
  ): Promise<ProjectRecord>;
  listSnapshots(projectId: string): Promise<ProjectSnapshotRecord[]>;
  getSnapshotById(snapshotId: string): Promise<ProjectSnapshotRecord | null>;
  saveSnapshot(input: SaveProjectSnapshotInput): Promise<ProjectSnapshotRecord>;
  getProjectWithActiveSnapshot(projectId: string): Promise<ProjectDetailRecord | null>;
  getActiveProjectDocument(projectId: string): Promise<VideoProject | null>;
}

export interface PresetRepository {
  getPresetById(presetId: string): Promise<PresetRecord | null>;
  listEnabledPresets(): Promise<PresetSummaryRecord[]>;
  upsertPreset(input: UpsertPresetInput): Promise<PresetRecord>;
  importLegacyPresets(presets: LegacySpecterrPreset[]): Promise<ImportLegacyPresetsResult>;
}

export interface AssetRepository {
  createPendingAsset(input: CreateMediaAssetInput): Promise<MediaAssetRecord>;
  completeAsset(assetId: string, input: CompleteMediaAssetInput): Promise<MediaAssetRecord>;
  failAsset(assetId: string, metadata?: JsonRecord): Promise<MediaAssetRecord>;
  getAssetById(assetId: string): Promise<MediaAssetRecord | null>;
  getAssetByStorageKey(storageKey: string): Promise<MediaAssetRecord | null>;
  findAssetBySha256(sha256: string): Promise<MediaAssetRecord | null>;
}

export interface AudioAnalysisRepository {
  getAnalysisById(analysisId: string): Promise<AudioAnalysisRecord | null>;
  getLatestByAssetId(assetId: string): Promise<AudioAnalysisRecord | null>;
  upsertAnalysis(input: UpsertAudioAnalysisInput): Promise<AudioAnalysisRecord>;
}

export interface ExportJobRepository {
  createQueuedJob(input: CreateExportJobInput): Promise<ExportJobRecord>;
  appendEvent(jobId: string, input: AppendExportJobEventInput): Promise<ExportJobEventRecord>;
  updateJobStatus(jobId: string, input: UpdateExportJobStatusInput): Promise<ExportJobRecord>;
  getJobById(jobId: string): Promise<ExportJobDetailRecord | null>;
  listJobsByProjectId(projectId: string): Promise<ExportJobRecord[]>;
  listEventsByJobId(jobId: string, cursor?: ExportEventCursorInput): Promise<ExportJobEventRecord[]>;
  listEventsByProjectId(
    projectId: string,
    cursor?: ExportEventCursorInput,
  ): Promise<ExportJobEventRecord[]>;
}

export interface RenderArtifactRepository {
  createArtifact(input: CreateRenderArtifactInput): Promise<RenderArtifactRecord>;
  getArtifactById(artifactId: string): Promise<RenderArtifactRecord | null>;
  getArtifactByStorageKey(storageKey: string): Promise<RenderArtifactRecord | null>;
  listArtifactsByExportJobId(exportJobId: string): Promise<RenderArtifactRecord[]>;
}

export type SpectralRepositories = {
  projectRepository: ProjectRepository;
  presetRepository: PresetRepository;
  assetRepository: AssetRepository;
  audioAnalysisRepository: AudioAnalysisRepository;
  exportJobRepository: ExportJobRepository;
  renderArtifactRepository: RenderArtifactRepository;
};

export type SpectralDataLayer = SpectralRepositories & {
  disconnect(): Promise<void>;
  transaction<T>(fn: (repositories: SpectralRepositories) => Promise<T>): Promise<T>;
};
