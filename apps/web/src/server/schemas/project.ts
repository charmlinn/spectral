import { videoProjectSchema } from "@spectral/project-schema";
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  presetId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  projectData: videoProjectSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  presetId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const saveProjectSnapshotSchema = z.object({
  projectData: videoProjectSchema,
  source: z.string().trim().min(1).optional(),
  reason: z.string().trim().nullable().optional(),
  schemaVersion: z.number().int().positive().optional(),
});
