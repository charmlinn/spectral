import type { WaveformOverview, WaveformPoint } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createWaveformOverview(
  channelData: Float32Array,
  sampleRate: number,
  targetPoints: number,
): WaveformOverview {
  const safePointCount = Math.max(1, targetPoints);
  const samplesPerPoint = Math.max(1, Math.floor(channelData.length / safePointCount));
  const points: WaveformPoint[] = [];

  for (let offset = 0; offset < channelData.length; offset += samplesPerPoint) {
    let min = 1;
    let max = -1;

    for (
      let sampleIndex = offset;
      sampleIndex < Math.min(offset + samplesPerPoint, channelData.length);
      sampleIndex += 1
    ) {
      const value = channelData[sampleIndex] ?? 0;
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }

    points.push({ min, max });
  }

  return {
    durationMs: (channelData.length / sampleRate) * 1000,
    sampleRate,
    samplesPerPoint,
    points,
  };
}

export function sliceWaveformOverview(
  overview: WaveformOverview,
  startMs: number,
  endMs: number,
  targetPoints = overview.points.length,
): WaveformOverview {
  const durationMs = Math.max(0, overview.durationMs);
  const safeStartMs = clamp(startMs, 0, durationMs);
  const safeEndMs = clamp(endMs, safeStartMs, durationMs);
  const startRatio = durationMs === 0 ? 0 : safeStartMs / durationMs;
  const endRatio = durationMs === 0 ? 0 : safeEndMs / durationMs;
  const startIndex = Math.floor(startRatio * overview.points.length);
  const endIndex = Math.max(startIndex + 1, Math.ceil(endRatio * overview.points.length));
  const slice = overview.points.slice(startIndex, endIndex);
  const step = Math.max(1, Math.floor(slice.length / Math.max(1, targetPoints)));
  const points: WaveformPoint[] = [];

  for (let index = 0; index < slice.length; index += step) {
    const batch = slice.slice(index, index + step);
    let min = 1;
    let max = -1;

    for (const point of batch) {
      min = Math.min(min, point.min);
      max = Math.max(max, point.max);
    }

    points.push({ min, max });
  }

  return {
    durationMs: safeEndMs - safeStartMs,
    sampleRate: overview.sampleRate,
    samplesPerPoint: overview.samplesPerPoint * step,
    points,
  };
}
