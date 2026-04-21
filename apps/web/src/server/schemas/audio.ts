import { z } from "zod";

export const requestAudioAnalysisSchema = z.object({
  assetId: z.string().uuid(),
  analyzerVersion: z.string().trim().min(1).default("v1"),
  force: z.boolean().optional(),
});
