import { notFound } from "../errors";
import { getServerRepositories } from "../repositories";

export async function listPresets() {
  const { presetRepository } = getServerRepositories();
  return presetRepository.listEnabledPresets();
}

export async function getPreset(presetId: string) {
  const { presetRepository } = getServerRepositories();
  const preset = await presetRepository.getPresetById(presetId);

  if (!preset) {
    throw notFound("Preset not found.", {
      presetId,
    });
  }

  return preset;
}
