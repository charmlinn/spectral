import { AUDIO_ANALYZER_CONSTANTS } from "./configuration/audio-analyzer-constants";
import {
  AUDIO_ANALYZER_OPTIONS,
  BASS_SPECTRUM_OPTIONS,
  WIDE_SPECTRUM_OPTIONS,
} from "./configuration/audio-analyzer-options";
import { createWaveformOverview } from "./protocol/waveform";
import type { AudioAnalysisSnapshot, SpectrumFrame } from "./protocol/types";
import {
  calculateCumulativeMaxMagnitude,
  decorateAudioFrequency,
} from "./helpers/audio-analyzer-calculations";
import { createFFTAnalyzer } from "./helpers/audio-analyzer-fft";

export type AnalyzeAudioBufferOptions = {
  fps?: number;
  waveformPoints?: number;
};

export type AnalyzeAudioChannelDataInput = {
  channels: readonly Float32Array[];
  sampleRate: number;
  durationMs?: number;
};

function mixChannelsToMono(channels: readonly Float32Array[]): Float32Array {
  const numberOfChannels = channels.length;

  if (numberOfChannels === 0) {
    return new Float32Array();
  }

  const length = channels[0]?.length ?? 0;

  if (numberOfChannels === 1) {
    const firstChannel = channels[0];

    return firstChannel ? new Float32Array(firstChannel) : new Float32Array();
  }

  const mixed = new Float32Array(length);

  for (
    let channelIndex = 0;
    channelIndex < numberOfChannels;
    channelIndex += 1
  ) {
    const channel = channels[channelIndex];

    if (!channel) {
      continue;
    }

    for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
      mixed[sampleIndex] =
        (mixed[sampleIndex] ?? 0) +
        (channel[sampleIndex] ?? 0) / numberOfChannels;
    }
  }

  return mixed;
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  return mixChannelsToMono(
    Array.from(
      { length: audioBuffer.numberOfChannels },
      (_, channelIndex) =>
        new Float32Array(audioBuffer.getChannelData(channelIndex)),
    ),
  );
}

function createFrameWindow(
  samples: Float32Array,
  frameIndex: number,
  sampleRate: number,
  fps: number,
  fftSize: number,
): Float32Array {
  const centerSample = Math.floor((frameIndex / fps) * sampleRate);
  const startSample = Math.max(0, centerSample - Math.floor(fftSize / 2));
  const windowSamples = new Float32Array(fftSize);
  const available = Math.min(fftSize, samples.length - startSample);

  for (let sampleIndex = 0; sampleIndex < available; sampleIndex += 1) {
    windowSamples[sampleIndex] = samples[startSample + sampleIndex] ?? 0;
  }

  return windowSamples;
}

function createWideSpectrumFrame(
  byteFrequencyData: Float32Array,
  cumulativeMaxMagnitude: number,
): Float32Array {
  return new Float32Array(
    decorateAudioFrequency(
      Array.from(
        byteFrequencyData.slice(
          WIDE_SPECTRUM_OPTIONS.spectrumStart,
          WIDE_SPECTRUM_OPTIONS.spectrumEnd,
        ),
      ),
      WIDE_SPECTRUM_OPTIONS.magnitudeTargetMax,
      WIDE_SPECTRUM_OPTIONS.exponent,
      WIDE_SPECTRUM_OPTIONS.root,
      WIDE_SPECTRUM_OPTIONS.baseBarCount,
      cumulativeMaxMagnitude,
    ),
  );
}

function createRawSpectrumSlice(
  byteFrequencyData: Float32Array,
  start: number,
  end: number,
) {
  return byteFrequencyData.slice(start, end);
}

function collectMaxMagnitudes(
  samples: Float32Array,
  sampleRate: number,
  durationMs: number,
): {
  bass: number;
  wide: number;
} {
  const analyzeByteFrequencyData = createFFTAnalyzer(
    AUDIO_ANALYZER_OPTIONS.fftSize,
    AUDIO_ANALYZER_OPTIONS.minDecibels,
    AUDIO_ANALYZER_OPTIONS.maxDecibels,
    AUDIO_ANALYZER_OPTIONS.smoothingTime,
  );
  const frameCount = Math.max(
    1,
    Math.ceil(
      (durationMs / 1000) * AUDIO_ANALYZER_CONSTANTS.maxMagnitudeAnalysisFps,
    ),
  );
  const bassMagnitudes: number[] = [];
  const wideMagnitudes: number[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameWindow = createFrameWindow(
      samples,
      frameIndex,
      sampleRate,
      AUDIO_ANALYZER_CONSTANTS.maxMagnitudeAnalysisFps,
      AUDIO_ANALYZER_OPTIONS.fftSize,
    );
    const byteFrequencyData = analyzeByteFrequencyData(
      frameWindow,
      AUDIO_ANALYZER_OPTIONS.clearFrequencyMaxLength,
    );
    const rawBassSpectrum = createRawSpectrumSlice(
      byteFrequencyData,
      BASS_SPECTRUM_OPTIONS.spectrumStart,
      BASS_SPECTRUM_OPTIONS.spectrumEnd,
    );
    const rawWideSpectrum = createRawSpectrumSlice(
      byteFrequencyData,
      WIDE_SPECTRUM_OPTIONS.spectrumStart,
      WIDE_SPECTRUM_OPTIONS.spectrumEnd,
    );

    bassMagnitudes.push(Math.max(...rawBassSpectrum, 0));
    wideMagnitudes.push(Math.max(...rawWideSpectrum, 0));
  }

  return {
    bass:
      calculateCumulativeMaxMagnitude(
        bassMagnitudes,
        AUDIO_ANALYZER_CONSTANTS.maxMagnitudeCalculationPercentile,
      ) ?? AUDIO_ANALYZER_CONSTANTS.defaultBassMaxMagnitude,
    wide:
      calculateCumulativeMaxMagnitude(
        wideMagnitudes,
        AUDIO_ANALYZER_CONSTANTS.maxMagnitudeCalculationPercentile,
      ) ?? AUDIO_ANALYZER_CONSTANTS.defaultWideMaxMagnitude,
  };
}

export function analyzeAudioBuffer(
  audioBuffer: AudioBuffer,
  options: AnalyzeAudioBufferOptions = {},
): AudioAnalysisSnapshot {
  return analyzeAudioChannelData(
    {
      channels: Array.from(
        { length: audioBuffer.numberOfChannels },
        (_, channelIndex) =>
          new Float32Array(audioBuffer.getChannelData(channelIndex)),
      ),
      durationMs: Math.round(audioBuffer.duration * 1000),
      sampleRate: audioBuffer.sampleRate,
    },
    options,
  );
}

export function analyzeAudioChannelData(
  input: AnalyzeAudioChannelDataInput,
  options: AnalyzeAudioBufferOptions = {},
): AudioAnalysisSnapshot {
  const fps = options.fps ?? 30;
  const mixedSamples = mixChannelsToMono(input.channels);
  const durationMs =
    input.durationMs ?? Math.round((mixedSamples.length / input.sampleRate) * 1000);
  const waveform = createWaveformOverview(
    mixedSamples,
    input.sampleRate,
    options.waveformPoints ??
      Math.max(1200, Math.round((durationMs / 1000) * 240)),
  );
  const frameCount = Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const analyzeByteFrequencyData = createFFTAnalyzer(
    AUDIO_ANALYZER_OPTIONS.fftSize,
    AUDIO_ANALYZER_OPTIONS.minDecibels,
    AUDIO_ANALYZER_OPTIONS.maxDecibels,
    AUDIO_ANALYZER_OPTIONS.smoothingTime,
  );
  const rawBassSpectrums: Float32Array[] = [];
  const rawWideSpectrums: Float32Array[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameWindow = createFrameWindow(
      mixedSamples,
      frameIndex,
      input.sampleRate,
      fps,
      AUDIO_ANALYZER_OPTIONS.fftSize,
    );
    const byteFrequencyData = analyzeByteFrequencyData(
      frameWindow,
      AUDIO_ANALYZER_OPTIONS.clearFrequencyMaxLength,
    );
    const rawBassSpectrum = createRawSpectrumSlice(
      byteFrequencyData,
      BASS_SPECTRUM_OPTIONS.spectrumStart,
      BASS_SPECTRUM_OPTIONS.spectrumEnd,
    );
    const rawWideSpectrum = createRawSpectrumSlice(
      byteFrequencyData,
      WIDE_SPECTRUM_OPTIONS.spectrumStart,
      WIDE_SPECTRUM_OPTIONS.spectrumEnd,
    );

    rawBassSpectrums.push(rawBassSpectrum);
    rawWideSpectrums.push(rawWideSpectrum);
  }

  const cumulativeMaxMagnitudes = collectMaxMagnitudes(
    mixedSamples,
    input.sampleRate,
    durationMs,
  );

  const spectrumFrames: SpectrumFrame[] = rawWideSpectrums.map(
    (rawWideSpectrum, frame) => ({
      frame,
      timeMs: Math.round((frame / fps) * 1000),
      values: createWideSpectrumFrame(
        rawWideSpectrum,
        cumulativeMaxMagnitudes.wide,
      ),
    }),
  );

  return {
    createdAt: new Date().toISOString(),
    fps,
    waveform,
    spectrumFrames,
    magnitudes: {
      bass: cumulativeMaxMagnitudes.bass,
      wide: cumulativeMaxMagnitudes.wide,
    },
  };
}
