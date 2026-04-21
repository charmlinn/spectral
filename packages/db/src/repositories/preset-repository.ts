import {
  VIDEO_PROJECT_SCHEMA_VERSION,
  legacyPresetToVideoProject,
  type LegacySpecterrPreset,
} from "@spectral/project-schema";

import type { DbClient } from "./shared";

function slugifyPresetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type UpsertPresetInput = {
  legacyPreset: LegacySpecterrPreset;
};

export function createPresetRepository(db: DbClient) {
  const repository = {
    async getPresetById(presetId: string) {
      return db.preset.findUnique({
        where: {
          id: presetId,
        },
      });
    },

    async listEnabledPresets() {
      return db.preset.findMany({
        where: {
          enabled: true,
        },
        orderBy: [{ priority: "desc" }, { popularity: "desc" }, { importedAt: "desc" }],
      });
    },

    async upsertPreset(input: UpsertPresetInput) {
      const preset = input.legacyPreset;
      const projectData = legacyPresetToVideoProject(preset);

      return db.preset.upsert({
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
          sourcePayload: preset,
          projectData,
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
          sourcePayload: preset,
          projectData,
          sourceUpdatedAt: preset.createdTime ? new Date(preset.createdTime) : null,
        },
      });
    },

    async importLegacyPresets(presets: LegacySpecterrPreset[]) {
      const results = [];

      for (const preset of presets) {
        results.push(await repository.upsertPreset({ legacyPreset: preset }));
      }

      return results;
    },
  };

  return repository;
}
