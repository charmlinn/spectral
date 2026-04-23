import { z } from "zod";
import {
  exportArtifactCreatedPayloadSchema,
  exportFormatSchema,
  exportJobFinalizePayloadSchema,
  exportJobStageUpdatePayloadSchema,
  workerHeartbeatPayloadSchema,
} from "@spectral/render-session";

export const createExportJobSchema = z.object({
  projectId: z.string().uuid(),
  snapshotId: z.string().uuid().optional(),
  preset: z.string().min(1).optional(),
  overrides: z
    .object({
      format: exportFormatSchema.optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      fps: z.number().int().positive().optional(),
      durationMs: z.number().int().positive().nullable().optional(),
    })
    .optional(),
  format: exportFormatSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).transform((input) => {
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.preset ? { requestedPreset: input.preset } : {}),
  };

  return {
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    format: input.overrides?.format ?? input.format,
    width: input.overrides?.width ?? input.width,
    height: input.overrides?.height ?? input.height,
    fps: input.overrides?.fps ?? input.fps,
    durationMs: input.overrides?.durationMs ?? input.durationMs,
    metadata,
  };
});

export const internalExportHeartbeatSchema = workerHeartbeatPayloadSchema;
export const internalExportStageSchema = exportJobStageUpdatePayloadSchema;
export const internalExportArtifactSchema = exportArtifactCreatedPayloadSchema;
export const internalExportFinalizeSchema = exportJobFinalizePayloadSchema;
