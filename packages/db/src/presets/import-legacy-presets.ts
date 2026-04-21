import { createPresetRepository } from "../repositories/preset-repository";
import type { DbClient } from "../repositories/shared";
import { loadBundledLegacyPresets } from "./load-legacy-presets";

export async function importBundledLegacyPresets(db: DbClient) {
  const { presets } = await loadBundledLegacyPresets();
  const repository = createPresetRepository(db);

  return repository.importLegacyPresets(presets);
}
