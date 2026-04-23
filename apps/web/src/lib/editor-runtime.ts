import {
  createArrayAudioAnalysisProvider,
  type AudioAnalysisMagnitudes,
  type AudioAnalysisProvider,
  type AudioAnalysisSnapshot,
  type SpectrumFrame,
  type WaveformOverview,
} from "@spectral/audio-analysis";
import type { MediaReference } from "@spectral/project-schema";
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

function toAudioAnalysisMagnitudes(value: unknown): AudioAnalysisMagnitudes {
  if (typeof value !== "object" || value === null) {
    return {
      bass: 250,
      wide: 250,
    };
  }

  const candidate = value as {
    bassMaxMagnitude?: unknown;
    bass?: unknown;
    magnitudes?: {
      bass?: unknown;
      wide?: unknown;
    } | null;
    wideMaxMagnitude?: unknown;
    wide?: unknown;
  };

  const bass =
    typeof candidate.bassMaxMagnitude === "number"
      ? candidate.bassMaxMagnitude
      : typeof candidate.bass === "number"
        ? candidate.bass
        : typeof candidate.magnitudes?.bass === "number"
          ? candidate.magnitudes.bass
          : 250;
  const wide =
    typeof candidate.wideMaxMagnitude === "number"
      ? candidate.wideMaxMagnitude
      : typeof candidate.wide === "number"
        ? candidate.wide
        : typeof candidate.magnitudes?.wide === "number"
          ? candidate.magnitudes.wide
          : 250;

  return {
    bass,
    wide,
  };
}

function toAnalysisFps(value: unknown): number {
  if (typeof value !== "object" || value === null) {
    return 30;
  }

  const candidate = value as {
    fps?: unknown;
  };

  return typeof candidate.fps === "number" && candidate.fps > 0
    ? candidate.fps
    : 30;
}

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

    if (
      typeof candidate.min !== "number" ||
      typeof candidate.max !== "number"
    ) {
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
          candidate.values.filter(
            (entry): entry is number => typeof entry === "number",
          ),
        ),
      },
    ];
  });
}

export function createAudioAnalysisProviderFromDto(
  analysis: AudioAnalysisDto,
): AudioAnalysisProvider {
  return createArrayAudioAnalysisProvider(
    createAudioAnalysisSnapshotFromDto(analysis),
  );
}

export function createAudioAnalysisSnapshotFromDto(
  analysis: AudioAnalysisDto,
): AudioAnalysisSnapshot {
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
    fps: toAnalysisFps(analysis.metadata),
    waveform,
    spectrumFrames: toSpectrumFrames(analysis.spectrumJson),
    magnitudes: toAudioAnalysisMagnitudes(analysis.metadata),
  };

  return snapshot;
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

export function serializeAudioAnalysisSnapshot(
  snapshot: AudioAnalysisSnapshot,
) {
  return {
    createdAt: snapshot.createdAt,
    fps: snapshot.fps,
    waveform: snapshot.waveform,
    spectrumFrames: snapshot.spectrumFrames.map((frame) => ({
      frame: frame.frame,
      timeMs: frame.timeMs,
      values: Array.from(frame.values),
    })),
    magnitudes: snapshot.magnitudes,
  };
}

export async function resolveMediaReferenceUrl(
  reference: MediaReference | null | undefined,
): Promise<string | null> {
  if (!reference) {
    return null;
  }

  if (reference.url) {
    return reference.url;
  }

  if (!reference.assetId) {
    return null;
  }

  return resolveAssetUrl(reference.assetId);
}

export async function resolveProjectAudioUrl(input: {
  assetId: string | null | undefined;
  source: MediaReference | null | undefined;
}): Promise<string | null> {
  const sourceUrl = await resolveMediaReferenceUrl(input.source);

  if (sourceUrl) {
    return sourceUrl;
  }

  if (input.assetId) {
    return resolveAssetUrl(input.assetId);
  }

  return null;
}
