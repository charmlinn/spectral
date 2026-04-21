import type { DbClient, JsonRecord } from "./shared";

export type UpsertAudioAnalysisInput = {
  assetId: string;
  analyzerVersion: string;
  durationMs: number;
  sampleRate?: number | null;
  channelCount?: number | null;
  sampleCount?: number | null;
  waveformJson?: unknown;
  spectrumJson?: unknown;
  waveformStorageKey?: string | null;
  spectrumStorageKey?: string | null;
  metadata?: JsonRecord;
};

export function createAudioAnalysisRepository(db: DbClient) {
  return {
    async getLatestByAssetId(assetId: string) {
      return db.audioAnalysis.findFirst({
        where: {
          assetId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },

    async upsertAnalysis(input: UpsertAudioAnalysisInput) {
      return db.audioAnalysis.upsert({
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
          waveformJson: input.waveformJson ?? null,
          spectrumJson: input.spectrumJson ?? null,
          waveformStorageKey: input.waveformStorageKey ?? null,
          spectrumStorageKey: input.spectrumStorageKey ?? null,
          metadata: input.metadata ?? {},
        },
        update: {
          durationMs: input.durationMs,
          sampleRate: input.sampleRate ?? null,
          channelCount: input.channelCount ?? null,
          sampleCount: input.sampleCount ?? null,
          waveformJson: input.waveformJson ?? null,
          spectrumJson: input.spectrumJson ?? null,
          waveformStorageKey: input.waveformStorageKey ?? null,
          spectrumStorageKey: input.spectrumStorageKey ?? null,
          metadata: input.metadata ?? {},
        },
      });
    },
  };
}
