import { z } from "zod";

export const requestAudioAnalysisSchema = z.object({
  assetId: z.string().uuid(),
  analyzerVersion: z.string().trim().min(1).default("v1"),
  force: z.boolean().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  sampleRate: z.number().int().positive().nullable().optional(),
  channelCount: z.number().int().positive().nullable().optional(),
  sampleCount: z.number().int().nonnegative().nullable().optional(),
  waveformJson: z.unknown().optional(),
  spectrumJson: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
