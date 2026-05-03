import {
  AUDIO_ANALYZER_CONSTANTS,
  EMPTY_AUDIO_FREQUENCY,
} from "../configuration/audio-analyzer-constants";
import { sliceWaveformOverview } from "../protocol/waveform";
import type {
  AudioAnalysisProvider,
  AudioAnalysisSnapshot,
  SpectrumFrame,
  WaveformOverview,
} from "../protocol/types";

function cloneSpectrum(values: Float32Array | undefined): Float32Array {
  if (!values) {
    return new Float32Array(EMPTY_AUDIO_FREQUENCY);
  }

  return new Float32Array(values);
}

function spectrumFrameValues(
  spectrumFrames: SpectrumFrame[],
  frame: number,
): Float32Array {
  const match =
    findNearestFrameByFrame(spectrumFrames, frame) ??
    findNearestFrameLinear(
      spectrumFrames,
      (candidate) => Math.abs(candidate.frame - frame),
    );

  return cloneSpectrum(match?.values);
}

function spectrumTimeValues(
  spectrumFrames: SpectrumFrame[],
  timeMs: number,
): Float32Array {
  const match =
    findNearestFrameByTimeMs(spectrumFrames, timeMs) ??
    findNearestFrameLinear(
      spectrumFrames,
      (candidate) => Math.abs(candidate.timeMs - timeMs),
    );

  return cloneSpectrum(match?.values);
}

function findNearestFrameLinear(
  spectrumFrames: SpectrumFrame[],
  predicate: (frame: SpectrumFrame) => number,
): SpectrumFrame | undefined {
  let closestFrame: SpectrumFrame | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const frame of spectrumFrames) {
    const distance = predicate(frame);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestFrame = frame;
    }
  }

  return closestFrame;
}

function findNearestFrameByFrame(
  spectrumFrames: SpectrumFrame[],
  frame: number,
): SpectrumFrame | undefined {
  if (spectrumFrames.length === 0) {
    return undefined;
  }

  let low = 0;
  let high = spectrumFrames.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = spectrumFrames[mid]!;

    if (candidate.frame === frame) {
      return candidate;
    }

    if (candidate.frame < frame) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const lower = spectrumFrames[Math.max(0, high)];
  const upper = spectrumFrames[Math.min(spectrumFrames.length - 1, low)];

  if (!lower) {
    return upper;
  }

  if (!upper) {
    return lower;
  }

  return Math.abs(lower.frame - frame) <= Math.abs(upper.frame - frame)
    ? lower
    : upper;
}

function findNearestFrameByTimeMs(
  spectrumFrames: SpectrumFrame[],
  timeMs: number,
): SpectrumFrame | undefined {
  if (spectrumFrames.length === 0) {
    return undefined;
  }

  let low = 0;
  let high = spectrumFrames.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = spectrumFrames[mid]!;

    if (candidate.timeMs === timeMs) {
      return candidate;
    }

    if (candidate.timeMs < timeMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const lower = spectrumFrames[Math.max(0, high)];
  const upper = spectrumFrames[Math.min(spectrumFrames.length - 1, low)];

  if (!lower) {
    return upper;
  }

  if (!upper) {
    return lower;
  }

  return Math.abs(lower.timeMs - timeMs) <= Math.abs(upper.timeMs - timeMs)
    ? lower
    : upper;
}

export class ArrayAudioAnalysisProvider implements AudioAnalysisProvider {
  public constructor(private readonly snapshot: AudioAnalysisSnapshot) {}

  public getWaveformSlice(
    startMs: number,
    endMs: number,
    targetPoints?: number,
  ): WaveformOverview {
    return sliceWaveformOverview(this.snapshot.waveform, startMs, endMs, targetPoints);
  }

  public getSpectrumAtFrame(frame: number): Float32Array {
    return this.getWideSpectrumAtFrame(frame);
  }

  public getSpectrumAtTimeMs(timeMs: number): Float32Array {
    return this.getWideSpectrumAtTimeMs(timeMs);
  }

  public getCurrentBassFrequency(timeMs = 0): Float32Array {
    return this.getBassSpectrumAtTimeMs(timeMs);
  }

  public getCurrentWideFrequency(timeMs = 0): Float32Array {
    return this.getWideSpectrumAtTimeMs(timeMs);
  }

  public getHistoricalBassFrequencies(timeMs = 0): number[][] {
    return this.getHistoricalSpectrumFrames(this.snapshot.bassSpectrumFrames, timeMs);
  }

  public getHistoricalWideFrequencies(timeMs = 0): number[][] {
    return this.getHistoricalSpectrumFrames(this.snapshot.wideSpectrumFrames, timeMs);
  }

  private getBassSpectrumAtFrame(frame: number): Float32Array {
    return spectrumFrameValues(this.snapshot.bassSpectrumFrames, frame);
  }

  private getWideSpectrumAtFrame(frame: number): Float32Array {
    return spectrumFrameValues(this.snapshot.wideSpectrumFrames, frame);
  }

  private getBassSpectrumAtTimeMs(timeMs: number): Float32Array {
    return spectrumTimeValues(this.snapshot.bassSpectrumFrames, timeMs);
  }

  private getWideSpectrumAtTimeMs(timeMs: number): Float32Array {
    return spectrumTimeValues(this.snapshot.wideSpectrumFrames, timeMs);
  }

  private getHistoricalSpectrumFrames(
    spectrumFrames: SpectrumFrame[],
    timeMs: number,
  ): number[][] {
    const frameMs = 1000 / Math.max(1, this.snapshot.fps);
    const history: number[][] = [];

    for (
      let frameDelay = 0;
      frameDelay < AUDIO_ANALYZER_CONSTANTS.historicalFrequenciesLimit;
      frameDelay += 1
    ) {
      const historyTimeMs = Math.max(0, timeMs - frameDelay * frameMs);
      history.push(Array.from(spectrumTimeValues(spectrumFrames, historyTimeMs)));
    }

    return history;
  }
}

export function createArrayAudioAnalysisProvider(
  snapshot: AudioAnalysisSnapshot,
): AudioAnalysisProvider {
  return new ArrayAudioAnalysisProvider(snapshot);
}
