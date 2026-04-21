import {
  VIDEO_PROJECT_SCHEMA_VERSION,
  legacyPresetToVideoProject,
  type LegacySpecterrPreset,
} from "@spectral/project-schema";

import type {
  ImportLegacyPresetsResult,
  PresetRecord,
  PresetRepository,
  PresetSummaryRecord,
  UpsertPresetInput,
} from "../contracts";
import type { DbClient } from "./shared";
import { mapPresetRecord, mapPresetSummaryRecord, toPrismaJsonValue } from "./shared";

function slugifyPresetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function upsertPresetWithDb(
  db: DbClient,
  input: UpsertPresetInput,
): Promise<PresetRecord> {
  const preset = input.legacyPreset;
  const projectData = legacyPresetToVideoProject(preset);
  const record = await db.preset.upsert({
    where: {
      id: preset.id,
    },
    create: {
      id: preset.id,
      slug: slugifyPresetName(preset.name),
      name: preset.name,
      enabled: preset.enabled ?? true,
      isPremium: preset.isPremium ?? false,
      recentlyAdded: preset.recentlyAdded ?? false,
      priority: preset.priority ?? 0,
      popularity: preset.popularity ?? 0,
      thumbnailUrl: preset.thumbnailUrl ?? preset.plainThumbnailUrl ?? null,
      exampleUrl: preset.exampleUrl ?? null,
      schemaVersion: VIDEO_PROJECT_SCHEMA_VERSION,
      sourcePayload: toPrismaJsonValue(preset),
      projectData: toPrismaJsonValue(projectData),
      sourceUpdatedAt: preset.createdTime ? new Date(preset.createdTime) : null,
    },
    update: {
      slug: slugifyPresetName(preset.name),
      name: preset.name,
      enabled: preset.enabled ?? true,
      isPremium: preset.isPremium ?? false,
      recentlyAdded: preset.recentlyAdded ?? false,
      priority: preset.priority ?? 0,
      popularity: preset.popularity ?? 0,
      thumbnailUrl: preset.thumbnailUrl ?? preset.plainThumbnailUrl ?? null,
      exampleUrl: preset.exampleUrl ?? null,
      schemaVersion: VIDEO_PROJECT_SCHEMA_VERSION,
      sourcePayload: toPrismaJsonValue(preset),
      projectData: toPrismaJsonValue(projectData),
      sourceUpdatedAt: preset.createdTime ? new Date(preset.createdTime) : null,
    },
  });

  return mapPresetRecord(record);
}

export function createPresetRepository(db: DbClient): PresetRepository {
  return {
    async getPresetById(presetId: string): Promise<PresetRecord | null> {
      const preset = await db.preset.findUnique({
        where: {
          id: presetId,
        },
      });

      return preset ? mapPresetRecord(preset) : null;
    },

    async listEnabledPresets(): Promise<PresetSummaryRecord[]> {
      const presets = await db.preset.findMany({
        where: {
          enabled: true,
        },
        orderBy: [{ priority: "desc" }, { popularity: "desc" }, { importedAt: "desc" }],
      });

      return presets.map(mapPresetSummaryRecord);
    },

    async upsertPreset(input: UpsertPresetInput): Promise<PresetRecord> {
      return upsertPresetWithDb(db, input);
    },

    async importLegacyPresets(
      presets: LegacySpecterrPreset[],
    ): Promise<ImportLegacyPresetsResult> {
      const imported: PresetRecord[] = [];

      for (const preset of presets) {
        imported.push(
          await upsertPresetWithDb(db, {
            legacyPreset: preset,
          }),
        );
      }

      return {
        importedCount: imported.length,
        presets: imported,
      };
    },
  };
}
