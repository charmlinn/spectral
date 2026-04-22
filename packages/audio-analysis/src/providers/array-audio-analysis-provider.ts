import { EMPTY_AUDIO_FREQUENCY } from "../configuration/audio-analyzer-constants";
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
    const match =
      findNearestFrameByFrame(this.snapshot.spectrumFrames, frame) ??
      findNearestFrameLinear(
        this.snapshot.spectrumFrames,
        (candidate) => Math.abs(candidate.frame - frame),
      );

    return cloneSpectrum(match?.values);
  }

  public getSpectrumAtTimeMs(timeMs: number): Float32Array {
    const match =
      findNearestFrameByTimeMs(this.snapshot.spectrumFrames, timeMs) ??
      findNearestFrameLinear(
        this.snapshot.spectrumFrames,
        (candidate) => Math.abs(candidate.timeMs - timeMs),
      );

    return cloneSpectrum(match?.values);
  }
}

export function createArrayAudioAnalysisProvider(
  snapshot: AudioAnalysisSnapshot,
): AudioAnalysisProvider {
  return new ArrayAudioAnalysisProvider(snapshot);
}
