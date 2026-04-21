import { z } from "zod";

export const createAssetUploadUrlSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["audio", "image", "video", "logo", "font", "thumbnail", "analysis", "other"]),
  contentType: z.string().trim().min(1),
  originalFilename: z.string().trim().min(1),
});

export const completeAssetSchema = z.object({
  assetId: z.string().uuid(),
  sha256: z.string().trim().nullable().optional(),
  byteSize: z.coerce.number().int().nonnegative().nullable().optional(),
  width: z.coerce.number().int().positive().nullable().optional(),
  height: z.coerce.number().int().positive().nullable().optional(),
  durationMs: z.coerce.number().int().nonnegative().nullable().optional(),
  sampleRate: z.coerce.number().int().positive().nullable().optional(),
  channels: z.coerce.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
