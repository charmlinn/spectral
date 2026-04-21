import { notFound } from "../errors";
import { getServerRepositories } from "../repositories";

export async function requestAudioAnalysis(input: {
  assetId: string;
  analyzerVersion: string;
  force?: boolean;
}) {
  const { assetRepository, audioAnalysisRepository } = getServerRepositories();
  const asset = await assetRepository.getAssetById(input.assetId);

  if (!asset) {
    throw notFound("Asset not found.", {
      assetId: input.assetId,
    });
  }

  const existing = await audioAnalysisRepository.getLatestByAssetId(input.assetId);

  if (
    existing &&
    existing.analyzerVersion === input.analyzerVersion &&
    !input.force
  ) {
    return {
      analysis: existing,
      reused: true,
    };
  }

  const analysis = await audioAnalysisRepository.upsertAnalysis({
    assetId: input.assetId,
    analyzerVersion: input.analyzerVersion,
    durationMs: asset.durationMs ?? 0,
    sampleRate: asset.sampleRate,
    channelCount: asset.channels,
    metadata: {
      status: "pending",
      requestedAt: new Date().toISOString(),
      note: "Audio analysis worker integration is pending codex3 alignment.",
    },
  });

  return {
    analysis,
    reused: false,
  };
}

export async function getAudioAnalysis(analysisId: string) {
  const { prisma } = getServerRepositories();
  const analysis = await prisma.audioAnalysis.findUnique({
    where: {
      id: analysisId,
    },
  });

  if (!analysis) {
    throw notFound("Audio analysis not found.", {
      analysisId,
    });
  }

  return analysis;
}
