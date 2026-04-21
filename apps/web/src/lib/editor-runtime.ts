import {
  createArrayAudioAnalysisProvider,
  type AudioAnalysisProvider,
  type AudioAnalysisSnapshot,
  type SpectrumFrame,
  type WaveformOverview,
} from "@spectral/audio-analysis";
import { createCachedBrowserAssetResolver } from "@spectral/render-runtime-browser";

import type { AudioAnalysisDto } from "./editor-api";
import { getAsset } from "./editor-api";

type WaveformPointDto = {
  min: number;
  max: number;
};

type SpectrumFrameDto = {
  frame: number;
  timeMs: number;
  values: number[];
};

function isWaveformOverview(value: unknown): value is WaveformOverview {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    durationMs?: unknown;
    sampleRate?: unknown;
    samplesPerPoint?: unknown;
    points?: unknown;
  };

  return (
    typeof candidate.durationMs === "number" &&
    typeof candidate.sampleRate === "number" &&
    typeof candidate.samplesPerPoint === "number" &&
    Array.isArray(candidate.points)
  );
}

function toWaveformPoints(points: unknown): WaveformPointDto[] {
  if (!Array.isArray(points)) {
    throw new Error("Audio analysis waveform points are missing.");
  }

  return points.flatMap((point) => {
    if (typeof point !== "object" || point === null) {
      return [];
    }

    const candidate = point as {
      min?: unknown;
      max?: unknown;
    };

    if (typeof candidate.min !== "number" || typeof candidate.max !== "number") {
      return [];
    }

    return [
      {
        min: candidate.min,
        max: candidate.max,
      },
    ];
  });
}

function toSpectrumFrames(value: unknown): SpectrumFrame[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((frame) => {
    if (typeof frame !== "object" || frame === null) {
      return [];
    }

    const candidate = frame as Partial<SpectrumFrameDto>;

    if (
      typeof candidate.frame !== "number" ||
      typeof candidate.timeMs !== "number" ||
      !Array.isArray(candidate.values)
    ) {
      return [];
    }

    return [
      {
        frame: candidate.frame,
        timeMs: candidate.timeMs,
        values: new Float32Array(
          candidate.values.filter((entry): entry is number => typeof entry === "number"),
        ),
      },
    ];
  });
}

export function createAudioAnalysisProviderFromDto(
  analysis: AudioAnalysisDto,
): AudioAnalysisProvider {
  if (!isWaveformOverview(analysis.waveformJson)) {
    throw new Error("Audio analysis waveform payload is invalid.");
  }

  const waveform: WaveformOverview = {
    durationMs: analysis.waveformJson.durationMs,
    sampleRate: analysis.waveformJson.sampleRate,
    samplesPerPoint: analysis.waveformJson.samplesPerPoint,
    points: toWaveformPoints(analysis.waveformJson.points),
  };

  const snapshot: AudioAnalysisSnapshot = {
    createdAt: analysis.createdAt,
    fps: 30,
    waveform,
    spectrumFrames: toSpectrumFrames(analysis.spectrumJson),
  };

  return createArrayAudioAnalysisProvider(snapshot);
}

async function resolveAssetUrl(assetId: string): Promise<string> {
  const asset = await getAsset(assetId);

  if (!asset.resolvedUrl) {
    throw new Error(`Asset ${assetId} is not ready.`);
  }

  return asset.resolvedUrl;
}

export function createProjectAssetResolver() {
  return createCachedBrowserAssetResolver({
    resolveImage: resolveAssetUrl,
    resolveVideo: resolveAssetUrl,
    resolveAudio: resolveAssetUrl,
    async resolveFont(fontId) {
      return resolveAssetUrl(fontId);
    },
  });
}

