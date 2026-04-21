import type { SpectralRepositories } from "../contracts";
import type { DbClient } from "./shared";
import { createAssetRepository } from "./asset-repository";
import { createAudioAnalysisRepository } from "./audio-analysis-repository";
import { createExportJobRepository } from "./export-job-repository";
import { createPresetRepository } from "./preset-repository";
import { createProjectRepository } from "./project-repository";
import { createRenderArtifactRepository } from "./render-artifact-repository";

export * from "./shared";
export * from "./project-repository";
export * from "./preset-repository";
export * from "./asset-repository";
export * from "./audio-analysis-repository";
export * from "./export-job-repository";
export * from "./render-artifact-repository";

export function createRepositories(db: DbClient): SpectralRepositories {
  return {
    projectRepository: createProjectRepository(db),
    presetRepository: createPresetRepository(db),
    assetRepository: createAssetRepository(db),
    audioAnalysisRepository: createAudioAnalysisRepository(db),
    exportJobRepository: createExportJobRepository(db),
    renderArtifactRepository: createRenderArtifactRepository(db),
  };
}
