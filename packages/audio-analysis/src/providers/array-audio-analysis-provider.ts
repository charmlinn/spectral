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

function findNearestFrame(
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
    const match = findNearestFrame(
      this.snapshot.spectrumFrames,
      (candidate) => Math.abs(candidate.frame - frame),
    );

    return cloneSpectrum(match?.values);
  }

  public getSpectrumAtTimeMs(timeMs: number): Float32Array {
    const match = findNearestFrame(
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
