import type {
  AudioAnalysisRecord,
  AudioAnalysisRepository,
  UpsertAudioAnalysisInput,
} from "../contracts";
import type { DbClient } from "./shared";
import {
  mapAudioAnalysisRecord,
  toPrismaJsonRecord,
  toPrismaNullableJsonValue,
} from "./shared";

export function createAudioAnalysisRepository(db: DbClient): AudioAnalysisRepository {
  return {
    async getAnalysisById(analysisId: string): Promise<AudioAnalysisRecord | null> {
      const analysis = await db.audioAnalysis.findUnique({
        where: {
          id: analysisId,
        },
      });

      return analysis ? mapAudioAnalysisRecord(analysis) : null;
    },

    async getLatestByAssetId(assetId: string): Promise<AudioAnalysisRecord | null> {
      const analysis = await db.audioAnalysis.findFirst({
        where: {
          assetId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return analysis ? mapAudioAnalysisRecord(analysis) : null;
    },

    async upsertAnalysis(input: UpsertAudioAnalysisInput): Promise<AudioAnalysisRecord> {
      const analysis = await db.audioAnalysis.upsert({
        where: {
          assetId_analyzerVersion: {
            assetId: input.assetId,
            analyzerVersion: input.analyzerVersion,
          },
        },
        create: {
          assetId: input.assetId,
          analyzerVersion: input.analyzerVersion,
          durationMs: input.durationMs,
          sampleRate: input.sampleRate ?? null,
          channelCount: input.channelCount ?? null,
          sampleCount: input.sampleCount ?? null,
          waveformJson: toPrismaNullableJsonValue(input.waveformJson),
          spectrumJson: toPrismaNullableJsonValue(input.spectrumJson),
          waveformStorageKey: input.waveformStorageKey ?? null,
          spectrumStorageKey: input.spectrumStorageKey ?? null,
          metadata: toPrismaJsonRecord(input.metadata),
        },
        update: {
          durationMs: input.durationMs,
          sampleRate: input.sampleRate ?? null,
          channelCount: input.channelCount ?? null,
          sampleCount: input.sampleCount ?? null,
          waveformJson: toPrismaNullableJsonValue(input.waveformJson),
          spectrumJson: toPrismaNullableJsonValue(input.spectrumJson),
          waveformStorageKey: input.waveformStorageKey ?? null,
          spectrumStorageKey: input.spectrumStorageKey ?? null,
          metadata: toPrismaJsonRecord(input.metadata),
        },
      });

      return mapAudioAnalysisRecord(analysis);
    },
  };
}
