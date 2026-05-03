import { videoProjectSchema } from "@spectral/project-schema";
import { z } from "zod";

export const RENDER_SESSION_PROTOCOL_VERSION = "spectral.render-session.v1" as const;

export const exportFormatValues = ["mp4", "mov", "webm"] as const;
export const mediaAssetKindValues = [
  "audio",
  "image",
  "video",
  "logo",
  "font",
  "thumbnail",
  "analysis",
  "other",
] as const;
export const mediaAssetStatusValues = ["pending", "ready", "failed", "deleted"] as const;
export const renderArtifactKindValues = [
  "waveform",
  "spectrum",
  "thumbnail",
  "export_chunk",
  "export_final",
  "poster",
  "preview_frame",
  "other",
] as const;
export const exportJobStageValues = [
  "session_ready",
  "assets_preflight",
  "assets_materializing",
  "renderer_warmup",
  "rendering",
  "encoding",
  "uploading",
  "finalizing",
] as const;
export const exportEventTypeValues = [
  "queued",
  "stage_changed",
  "progress",
  "heartbeat",
  "artifact_created",
  "retry_scheduled",
  "completed",
  "failed",
  "cancelled",
] as const;
export const renderSessionAssetBindingRoleValues = [
  "audio",
  "backdrop",
  "visualizer-media",
  "visualizer-logo",
] as const;
export const exportJobFinalizeStatusValues = ["completed", "failed", "cancelled"] as const;

export const exportFormatSchema = z.enum(exportFormatValues);
export const mediaAssetKindSchema = z.enum(mediaAssetKindValues);
export const mediaAssetStatusSchema = z.enum(mediaAssetStatusValues);
export const renderArtifactKindSchema = z.enum(renderArtifactKindValues);
export const exportJobStageSchema = z.enum(exportJobStageValues);
export const exportEventTypeSchema = z.enum(exportEventTypeValues);
export const renderSessionAssetBindingRoleSchema = z.enum(
  renderSessionAssetBindingRoleValues,
);
export const exportJobFinalizeStatusSchema = z.enum(exportJobFinalizeStatusValues);

export const renderSessionAssetBindingSchema = z.object({
  role: renderSessionAssetBindingRoleSchema,
  assetId: z.string(),
  kind: mediaAssetKindSchema,
  status: mediaAssetStatusSchema,
  storageKey: z.string(),
  mimeType: z.string().nullable(),
  resolvedUrl: z.string().nullable(),
});

export const renderSessionFontManifestItemSchema = z.object({
  family: z.string().min(1),
  style: z.string().nullable(),
  weight: z.union([z.string(), z.number().int().positive()]).nullable(),
  fallbackFamilies: z.array(z.string()),
  assetId: z.string().nullable(),
  storageKey: z.string().nullable(),
  resolvedUrl: z.string().nullable(),
});

export const renderSessionWaveformPointSchema = z.object({
  min: z.number(),
  max: z.number(),
});

export const renderSessionWaveformSchema = z.object({
  durationMs: z.number().nonnegative(),
  sampleRate: z.number().nonnegative(),
  samplesPerPoint: z.number().nonnegative(),
  points: z.array(renderSessionWaveformPointSchema),
});

export const renderSessionSpectrumFrameSchema = z.object({
  frame: z.number().int().nonnegative(),
  timeMs: z.number().nonnegative(),
  values: z.array(z.number()),
});

export const renderSessionAudioAnalysisMagnitudesSchema = z.object({
  bass: z.number().positive(),
  wide: z.number().positive(),
});

export const renderSessionAudioAnalysisSnapshotSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  fps: z.number().positive(),
  waveform: renderSessionWaveformSchema,
  bassSpectrumFrames: z.array(renderSessionSpectrumFrameSchema),
  wideSpectrumFrames: z.array(renderSessionSpectrumFrameSchema),
  magnitudes: renderSessionAudioAnalysisMagnitudesSchema,
});

export const renderSessionAudioAnalysisRefSchema = z.object({
  analysisId: z.string().nullable(),
  snapshot: renderSessionAudioAnalysisSnapshotSchema.nullable(),
});

export const renderSessionRuntimeSchema = z.object({
  mode: z.literal("export"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  dpr: z.number().positive(),
  fps: z.number().positive(),
  durationMs: z.number().positive(),
  frameCount: z.number().int().positive(),
  backgroundColor: z.string().nullable(),
});

export const renderSessionProjectSchema = z.object({
  document: videoProjectSchema,
  schemaVersion: z.number().int().positive(),
});

export const renderSessionAssetsSchema = z.object({
  bindings: z.array(renderSessionAssetBindingSchema),
  fonts: z.array(renderSessionFontManifestItemSchema),
  audioAnalysis: renderSessionAudioAnalysisRefSchema.nullable(),
});

export const renderSessionOutputSchema = z.object({
  format: exportFormatSchema,
  videoCodec: z.string().min(1),
  audioCodec: z.string().min(1),
  posterFrame: z.number().int().nonnegative().nullable(),
  thumbnailFrames: z.array(z.number().int().nonnegative()),
});

export const renderSessionDiagnosticsSchema = z.object({
  parityPresetKey: z.string().nullable(),
  sampleFrames: z.array(z.number().int().nonnegative()),
  enableFrameHashes: z.boolean(),
});

export const renderSessionPublicRoutesSchema = z.object({
  statusPath: z.string(),
  pagePath: z.string(),
  bootstrapPath: z.string(),
  cancelPath: z.string(),
  exportEventsPath: z.string(),
  projectEventsPath: z.string(),
});

export const renderSessionInternalRoutesSchema = z.object({
  sessionPath: z.string(),
  heartbeatPath: z.string(),
  stagePath: z.string(),
  artifactsPath: z.string(),
  finalizePath: z.string(),
});

export const renderSessionRoutesSchema = z.object({
  public: renderSessionPublicRoutesSchema,
  internal: renderSessionInternalRoutesSchema,
});

export const renderSessionSchema = z.object({
  protocolVersion: z.literal(RENDER_SESSION_PROTOCOL_VERSION),
  sessionId: z.string(),
  exportJobId: z.string(),
  projectId: z.string(),
  snapshotId: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  runtime: renderSessionRuntimeSchema,
  project: renderSessionProjectSchema,
  assets: renderSessionAssetsSchema,
  output: renderSessionOutputSchema,
  diagnostics: renderSessionDiagnosticsSchema,
  routes: renderSessionRoutesSchema,
});

export const exportEventSchema = z.object({
  id: z.string(),
  exportJobId: z.string(),
  type: exportEventTypeSchema,
  stage: exportJobStageSchema.nullable(),
  progressPct: z.number().min(0).max(100).nullable(),
  message: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

const workerMutationBaseSchema = z.object({
  workerId: z.string().min(1),
  attempt: z.number().int().positive(),
});

export const workerHeartbeatPayloadSchema = workerMutationBaseSchema.extend({
  heartbeatAt: z.string().datetime({ offset: true }),
  stage: exportJobStageSchema.nullable().optional(),
  progressPct: z.number().min(0).max(100).nullable().optional(),
  message: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const exportJobStageUpdatePayloadSchema = workerMutationBaseSchema.extend({
  stage: exportJobStageSchema,
  progressPct: z.number().min(0).max(100).nullable().optional(),
  message: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const exportArtifactDescriptorSchema = z.object({
  kind: renderArtifactKindSchema,
  storageKey: z.string(),
  mimeType: z.string().nullable().optional(),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const exportArtifactCreatedPayloadSchema = workerMutationBaseSchema.extend({
  artifact: exportArtifactDescriptorSchema,
  message: z.string().nullable().optional(),
});

export const exportJobFinalizePayloadSchema = workerMutationBaseSchema.extend({
  status: exportJobFinalizeStatusSchema,
  progressPct: z.number().min(0).max(100).nullable().optional(),
  message: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  outputStorageKey: z.string().nullable().optional(),
  posterStorageKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type MediaAssetKind = z.infer<typeof mediaAssetKindSchema>;
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>;
export type RenderArtifactKind = z.infer<typeof renderArtifactKindSchema>;
export type ExportJobStage = z.infer<typeof exportJobStageSchema>;
export type ExportEventType = z.infer<typeof exportEventTypeSchema>;
export type RenderSessionAssetBindingRole = z.infer<
  typeof renderSessionAssetBindingRoleSchema
>;
export type RenderSessionAssetBinding = z.infer<typeof renderSessionAssetBindingSchema>;
export type RenderSessionFontManifestItem = z.infer<
  typeof renderSessionFontManifestItemSchema
>;
export type RenderSessionAudioAnalysisSnapshot = z.infer<
  typeof renderSessionAudioAnalysisSnapshotSchema
>;
export type RenderSessionAudioAnalysisRef = z.infer<
  typeof renderSessionAudioAnalysisRefSchema
>;
export type RenderSessionRuntime = z.infer<typeof renderSessionRuntimeSchema>;
export type RenderSessionProject = z.infer<typeof renderSessionProjectSchema>;
export type RenderSessionAssets = z.infer<typeof renderSessionAssetsSchema>;
export type RenderSessionOutput = z.infer<typeof renderSessionOutputSchema>;
export type RenderSessionDiagnostics = z.infer<typeof renderSessionDiagnosticsSchema>;
export type RenderSessionPublicRoutes = z.infer<typeof renderSessionPublicRoutesSchema>;
export type RenderSessionInternalRoutes = z.infer<typeof renderSessionInternalRoutesSchema>;
export type RenderSessionRoutes = z.infer<typeof renderSessionRoutesSchema>;
export type RenderSession = z.infer<typeof renderSessionSchema>;
export type ExportEvent = z.infer<typeof exportEventSchema>;
export type WorkerHeartbeatPayload = z.infer<typeof workerHeartbeatPayloadSchema>;
export type ExportJobStageUpdatePayload = z.infer<
  typeof exportJobStageUpdatePayloadSchema
>;
export type ExportArtifactDescriptor = z.infer<typeof exportArtifactDescriptorSchema>;
export type ExportArtifactCreatedPayload = z.infer<
  typeof exportArtifactCreatedPayloadSchema
>;
export type ExportJobFinalizeStatus = z.infer<typeof exportJobFinalizeStatusSchema>;
export type ExportJobFinalizePayload = z.infer<typeof exportJobFinalizePayloadSchema>;
