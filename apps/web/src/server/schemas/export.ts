import { z } from "zod";

export const createExportJobSchema = z.object({
  projectId: z.string().uuid(),
  snapshotId: z.string().uuid().optional(),
  format: z.enum(["mp4", "mov", "webm"]).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
