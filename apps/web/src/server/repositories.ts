import {
  createAssetRepository,
  createAudioAnalysisRepository,
  createExportJobRepository,
  createPresetRepository,
  createProjectRepository,
  createRenderArtifactRepository,
  getPrismaClient,
} from "@spectral/db";

const prisma = getPrismaClient();

export function getServerRepositories() {
  return {
    prisma,
    assetRepository: createAssetRepository(prisma),
    audioAnalysisRepository: createAudioAnalysisRepository(prisma),
    exportJobRepository: createExportJobRepository(prisma),
    presetRepository: createPresetRepository(prisma),
    projectRepository: createProjectRepository(prisma),
    renderArtifactRepository: createRenderArtifactRepository(prisma),
  };
}
