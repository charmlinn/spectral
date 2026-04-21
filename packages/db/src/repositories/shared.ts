import { migrateVideoProjectDocument, type LegacySpecterrPreset } from "@spectral/project-schema";

import type {
  AudioAnalysisRecord,
  ExportJobEventRecord,
  ExportJobRecord,
  JsonRecord,
  JsonValue,
  MediaAssetRecord,
  PresetRecord,
  PresetSummaryRecord,
  ProjectRecord,
  ProjectSnapshotRecord,
  RenderArtifactRecord,
} from "../contracts";
import { Prisma, type PrismaClient } from "../generated/client/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

function normalizePrismaJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizePrismaJsonValue(entry)) as Prisma.InputJsonArray;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .map(([key, entry]) => {
        const normalized = normalizePrismaJsonValue(entry);

        if (normalized === null && entry === undefined) {
          return null;
        }

        return [key, normalized] as const;
      })
      .filter((entry): entry is readonly [string, Prisma.InputJsonValue | null] => entry !== null);

    return Object.fromEntries(entries) as Prisma.InputJsonObject;
  }

  return null;
}

export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return (normalizePrismaJsonValue(value) ?? {}) as Prisma.InputJsonValue;
}

export function toPrismaNullableJsonValue(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  const normalized = normalizePrismaJsonValue(value);

  if (normalized === null) {
    return Prisma.DbNull;
  }

  return normalized;
}

export function toPrismaJsonRecord(value: unknown): Prisma.InputJsonValue {
  const normalized = normalizePrismaJsonValue(value);

  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    return normalized;
  }

  return {};
}

export function toJsonRecord(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

export function toJsonValue(value: unknown): JsonValue | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry)) as JsonValue[];
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]),
    ) as JsonValue;
  }

  return null;
}

export function mapProjectRecord(project: {
  id: string;
  name: string;
  description: string | null;
  presetId: string | null;
  activeSnapshotId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    presetId: project.presetId,
    activeSnapshotId: project.activeSnapshotId,
    metadata: toJsonRecord(project.metadata),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    archivedAt: project.archivedAt,
  };
}

export function mapProjectSnapshotRecord(snapshot: {
  id: string;
  projectId: string;
  schemaVersion: number;
  snapshotIndex: number;
  source: string;
  reason: string | null;
  projectData: unknown;
  createdAt: Date;
}): ProjectSnapshotRecord {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    schemaVersion: snapshot.schemaVersion,
    snapshotIndex: snapshot.snapshotIndex,
    source: snapshot.source,
    reason: snapshot.reason,
    projectData: migrateVideoProjectDocument(snapshot.projectData),
    createdAt: snapshot.createdAt,
  };
}

export function mapPresetSummaryRecord(preset: {
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
}): PresetSummaryRecord {
  return {
    id: preset.id,
    slug: preset.slug,
    name: preset.name,
    enabled: preset.enabled,
    isPremium: preset.isPremium,
    recentlyAdded: preset.recentlyAdded,
    priority: preset.priority,
    popularity: preset.popularity,
    thumbnailUrl: preset.thumbnailUrl,
    exampleUrl: preset.exampleUrl,
    importedAt: preset.importedAt,
    updatedAt: preset.updatedAt,
  };
}

export function mapPresetRecord(preset: {
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
  schemaVersion: number;
  projectData: unknown;
  sourcePayload: unknown;
  sourceUpdatedAt: Date | null;
  importedAt: Date;
  updatedAt: Date;
}): PresetRecord {
  return {
    ...mapPresetSummaryRecord(preset),
    schemaVersion: preset.schemaVersion,
    projectData: migrateVideoProjectDocument(preset.projectData),
    sourcePayload: preset.sourcePayload as LegacySpecterrPreset,
    sourceUpdatedAt: preset.sourceUpdatedAt,
  };
}

export function mapMediaAssetRecord(asset: {
  id: string;
  projectId: string | null;
  kind: MediaAssetRecord["kind"];
  status: MediaAssetRecord["status"];
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
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): MediaAssetRecord {
  return {
    id: asset.id,
    projectId: asset.projectId,
    kind: asset.kind,
    status: asset.status,
    storageKey: asset.storageKey,
    bucket: asset.bucket,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sha256: asset.sha256,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    sampleRate: asset.sampleRate,
    channels: asset.channels,
    metadata: toJsonRecord(asset.metadata),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    completedAt: asset.completedAt,
  };
}

export function mapAudioAnalysisRecord(analysis: {
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
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AudioAnalysisRecord {
  return {
    id: analysis.id,
    assetId: analysis.assetId,
    analyzerVersion: analysis.analyzerVersion,
    durationMs: analysis.durationMs,
    sampleRate: analysis.sampleRate,
    channelCount: analysis.channelCount,
    sampleCount: analysis.sampleCount,
    waveformJson: toJsonValue(analysis.waveformJson),
    spectrumJson: toJsonValue(analysis.spectrumJson),
    waveformStorageKey: analysis.waveformStorageKey,
    spectrumStorageKey: analysis.spectrumStorageKey,
    metadata: toJsonRecord(analysis.metadata),
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
}

export function mapExportJobRecord(job: {
  id: string;
  projectId: string;
  snapshotId: string;
  status: ExportJobRecord["status"];
  format: ExportJobRecord["format"];
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
  metadata: unknown;
  createdAt: Date;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  updatedAt: Date;
}): ExportJobRecord {
  return {
    id: job.id,
    projectId: job.projectId,
    snapshotId: job.snapshotId,
    status: job.status,
    format: job.format,
    width: job.width,
    height: job.height,
    fps: job.fps,
    durationMs: job.durationMs,
    attempts: job.attempts,
    progress: job.progress,
    outputStorageKey: job.outputStorageKey,
    posterStorageKey: job.posterStorageKey,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    metadata: toJsonRecord(job.metadata),
    createdAt: job.createdAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    cancelledAt: job.cancelledAt,
    updatedAt: job.updatedAt,
  };
}

export function mapExportJobEventRecord(event: {
  id: bigint;
  jobId: string;
  projectId: string | null;
  level: ExportJobEventRecord["level"];
  type: string;
  message: string | null;
  progress: number | null;
  payload: unknown;
  createdAt: Date;
}): ExportJobEventRecord {
  return {
    id: event.id,
    jobId: event.jobId,
    projectId: event.projectId,
    level: event.level,
    type: event.type,
    message: event.message,
    progress: event.progress,
    payload: toJsonRecord(event.payload),
    createdAt: event.createdAt,
  };
}

export function mapRenderArtifactRecord(artifact: {
  id: string;
  projectId: string | null;
  exportJobId: string | null;
  kind: RenderArtifactRecord["kind"];
  storageKey: string;
  mimeType: string | null;
  byteSize: bigint | null;
  metadata: unknown;
  createdAt: Date;
}): RenderArtifactRecord {
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    exportJobId: artifact.exportJobId,
    kind: artifact.kind,
    storageKey: artifact.storageKey,
    mimeType: artifact.mimeType,
    byteSize: artifact.byteSize,
    metadata: toJsonRecord(artifact.metadata),
    createdAt: artifact.createdAt,
  };
}
