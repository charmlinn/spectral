import type { ImportLegacyPresetsResult, PresetRepository } from "../contracts";
import { loadBundledLegacyPresets } from "./load-legacy-presets";

export async function importBundledLegacyPresets(
  presetRepository: PresetRepository,
): Promise<ImportLegacyPresetsResult> {
  const { presets } = await loadBundledLegacyPresets();

  return presetRepository.importLegacyPresets(presets);
}
