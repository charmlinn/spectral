import type { JsonRecord, JsonValue } from "@spectral/db";

import { badRequest } from "../errors";
import { notFound } from "../errors";
import { getServerRepositories } from "../repositories";

export async function requestAudioAnalysis(input: {
  assetId: string;
  analyzerVersion: string;
  force?: boolean;
  durationMs?: number;
  sampleRate?: number | null;
  channelCount?: number | null;
  sampleCount?: number | null;
  waveformJson?: JsonValue;
  spectrumJson?: JsonValue[];
  metadata?: JsonRecord;
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

  if (!input.waveformJson || !input.spectrumJson) {
    throw badRequest("Audio analysis payload is required when no reusable analysis exists.", {
      assetId: input.assetId,
      analyzerVersion: input.analyzerVersion,
    });
  }

  const analysis = await audioAnalysisRepository.upsertAnalysis({
    assetId: input.assetId,
    analyzerVersion: input.analyzerVersion,
    durationMs: input.durationMs ?? asset.durationMs ?? 0,
    sampleRate: input.sampleRate ?? asset.sampleRate,
    channelCount: input.channelCount ?? asset.channels,
    sampleCount: input.sampleCount ?? null,
    waveformJson: input.waveformJson,
    spectrumJson: input.spectrumJson,
    metadata: {
      status: "ready",
      requestedAt: new Date().toISOString(),
      ...(input.metadata ?? {}),
    },
  });

  return {
    analysis,
    reused: false,
  };
}

export async function getAudioAnalysis(analysisId: string) {
  const { audioAnalysisRepository } = getServerRepositories();
  const analysis = await audioAnalysisRepository.getAnalysisById(analysisId);

  if (!analysis) {
    throw notFound("Audio analysis not found.", {
      analysisId,
    });
  }

  return analysis;
}
