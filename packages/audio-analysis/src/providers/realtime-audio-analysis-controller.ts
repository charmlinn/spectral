/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Audio/RealtimeAudioAnalyzer.js
 * 已迁移为 TS。
 */

import {
  AUDIO_ANALYZER_CONSTANTS,
} from "../configuration/audio-analyzer-constants";
import {
  AUDIO_ANALYZER_OPTIONS,
  BASS_SPECTRUM_OPTIONS,
  WIDE_SPECTRUM_OPTIONS,
} from "../configuration/audio-analyzer-options";
import { decorateAudioFrequency } from "../helpers/audio-analyzer-calculations";
import { createFFTAnalyzer } from "../helpers/audio-analyzer-fft";
import type { AudioAnalysisProvider, WaveformOverview } from "../protocol/types";
import { sliceWaveformOverview } from "../protocol/waveform";

type SpectrumKind = "bass" | "wide";

export type RealtimeAudioAnalysisMagnitudes = {
  bass: number;
  wide: number;
};

export type RealtimeAudioAnalysisControllerOptions = {
  audioElement: HTMLMediaElement;
  fps?: number;
  waveform?: WaveformOverview | null;
  audioContext?: AudioContext;
  volume?: number;
};

export type RealtimeAudioAnalysisController = AudioAnalysisProvider & {
  connect(): Promise<void>;
  destroy(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seekToMs(ms: number): void;
  getCurrentTimeMs(): number;
  setVolume(volume: number): void;
  getVolume(): number;
  setMaxMagnitudes(values: RealtimeAudioAnalysisMagnitudes): void;
  getCurrentBassFrequency(): number[];
  getCurrentWideFrequency(): number[];
  getHistoricalBassFrequencies(includeNextFrame?: boolean): number[][];
  getHistoricalWideFrequencies(includeNextFrame?: boolean): number[][];
};

type InternalState = {
  analyzerNode: AnalyserNode | null;
  audioContext: AudioContext | null;
  delayNode: DelayNode | null;
  mediaSource: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  getByteFrequencyData: ReturnType<typeof createFFTAnalyzer> | null;
  bassMaxMagnitude: number | null;
  wideMaxMagnitude: number | null;
  historicalBassFrequencies: number[][];
  historicalWideFrequencies: number[][];
  fps: number;
  volume: number;
};

function createInitialState(options: RealtimeAudioAnalysisControllerOptions): InternalState {
  return {
    analyzerNode: null,
    audioContext: options.audioContext ?? null,
    delayNode: null,
    mediaSource: null,
    gainNode: null,
    getByteFrequencyData: null,
    bassMaxMagnitude: null,
    wideMaxMagnitude: null,
    historicalBassFrequencies: [],
    historicalWideFrequencies: [],
    fps: options.fps ?? 60,
    volume: options.volume ?? 0,
  };
}

function concatHistoricalFrequencies(
  currentFrequency: number[],
  historicalFrequencies: number[][],
  limit: number,
): number[][] {
  historicalFrequencies.unshift(currentFrequency);

  if (historicalFrequencies.length < limit) {
    for (let index = historicalFrequencies.length; index < limit; index += 1) {
      historicalFrequencies.push(currentFrequency);
    }
  }

  if (historicalFrequencies.length > limit) {
    historicalFrequencies.splice(limit, historicalFrequencies.length - limit);
  }

  return historicalFrequencies;
}

export function createRealtimeAudioAnalysisController(
  options: RealtimeAudioAnalysisControllerOptions,
): RealtimeAudioAnalysisController {
  const state = createInitialState(options);
  const { audioElement, waveform } = options;

  function getConnectedState(): InternalState & {
    analyzerNode: AnalyserNode;
    audioContext: AudioContext;
    mediaSource: MediaElementAudioSourceNode;
    gainNode: GainNode;
    getByteFrequencyData: ReturnType<typeof createFFTAnalyzer>;
  } {
    if (
      !state.analyzerNode ||
      !state.audioContext ||
      !state.mediaSource ||
      !state.gainNode ||
      !state.getByteFrequencyData
    ) {
      throw new Error("Realtime audio analysis is not connected. Call connect() first.");
    }

    return {
      ...state,
      analyzerNode: state.analyzerNode,
      audioContext: state.audioContext,
      mediaSource: state.mediaSource,
      gainNode: state.gainNode,
      getByteFrequencyData: state.getByteFrequencyData,
    };
  }

  function assertMagnitudesReady(kind: SpectrumKind): number {
    const magnitude = kind === "bass" ? state.bassMaxMagnitude : state.wideMaxMagnitude;

    if (!magnitude) {
      throw new Error(
        `Realtime audio analysis is missing ${kind} max magnitude. Call setMaxMagnitudes() before sampling spectrum.`,
      );
    }

    return magnitude;
  }

  async function connect(): Promise<void> {
    if (state.analyzerNode) {
      return;
    }

    const getByteFrequencyData = createFFTAnalyzer(
      AUDIO_ANALYZER_OPTIONS.fftSize,
      AUDIO_ANALYZER_OPTIONS.minDecibels,
      AUDIO_ANALYZER_OPTIONS.maxDecibels,
      AUDIO_ANALYZER_OPTIONS.smoothingTime,
    );
    const audioContext = state.audioContext ?? new AudioContext();
    const analyzerNode = audioContext.createAnalyser();
    analyzerNode.fftSize = AUDIO_ANALYZER_OPTIONS.fftSize;
    analyzerNode.smoothingTimeConstant = 0;

    const mediaSource = audioContext.createMediaElementSource(audioElement);
    mediaSource.connect(analyzerNode);

    const gainNode = audioContext.createGain();
    gainNode.gain.value = state.volume;
    analyzerNode.connect(gainNode);
    const delayNode = new DelayNode(audioContext, { delayTime: 0.15 });
    gainNode.connect(delayNode);
    delayNode.connect(audioContext.destination);

    state.audioContext = audioContext;
    state.analyzerNode = analyzerNode;
    state.delayNode = delayNode;
    state.mediaSource = mediaSource;
    state.gainNode = gainNode;
    state.getByteFrequencyData = getByteFrequencyData;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  function getCurrentFrequency(kind: SpectrumKind): number[] {
    const connectedState = getConnectedState();

    const maxMagnitude = assertMagnitudesReady(kind);
    const timeDomainData = new Float32Array(connectedState.analyzerNode.fftSize);
    connectedState.analyzerNode.getFloatTimeDomainData(timeDomainData);
    const clearFrequency = connectedState.getByteFrequencyData(
      timeDomainData,
      AUDIO_ANALYZER_OPTIONS.clearFrequencyMaxLength,
    );

    const spectrumOptions =
      kind === "bass" ? BASS_SPECTRUM_OPTIONS : WIDE_SPECTRUM_OPTIONS;

    return decorateAudioFrequency(
      Array.from(
        clearFrequency.slice(spectrumOptions.spectrumStart, spectrumOptions.spectrumEnd),
      ),
      kind === "bass"
        ? BASS_SPECTRUM_OPTIONS.magnitudeTargetMax
        : WIDE_SPECTRUM_OPTIONS.magnitudeTargetMax,
      kind === "bass" ? BASS_SPECTRUM_OPTIONS.exponent : WIDE_SPECTRUM_OPTIONS.exponent,
      kind === "bass" ? BASS_SPECTRUM_OPTIONS.root : WIDE_SPECTRUM_OPTIONS.root,
      kind === "bass"
        ? BASS_SPECTRUM_OPTIONS.baseBarCount
        : WIDE_SPECTRUM_OPTIONS.baseBarCount,
      maxMagnitude,
    );
  }

  function getHistoricalFrequencies(kind: SpectrumKind, includeNextFrame = true): number[][] {
    const history =
      kind === "bass"
        ? state.historicalBassFrequencies
        : state.historicalWideFrequencies;

    if (!includeNextFrame && history.length > 0) {
      return history;
    }

    concatHistoricalFrequencies(
      getCurrentFrequency(kind),
      history,
      AUDIO_ANALYZER_CONSTANTS.historicalFrequenciesLimit,
    );

    return history;
  }

  function assertRealtimeTime(targetTimeMs: number): void {
    const currentTimeMs = audioElement.currentTime * 1000;
    const tolerance = 1000 / state.fps;

    if (Math.abs(currentTimeMs - targetTimeMs) > tolerance) {
      throw new Error(
        `Realtime audio analysis can only sample the current playback time. Requested ${targetTimeMs}ms, current ${currentTimeMs}ms.`,
      );
    }
  }

  return {
    async connect() {
      await connect();
    },
    async destroy() {
      if (
        !state.gainNode ||
        !state.analyzerNode ||
        !state.mediaSource ||
        !state.delayNode
      ) {
        return;
      }

      const destination = state.audioContext?.destination;
      if (!destination) {
        throw new Error("Realtime audio analysis is missing AudioContext destination.");
      }

      state.delayNode.disconnect(destination);
      state.gainNode.disconnect(state.delayNode);
      state.analyzerNode.disconnect(state.gainNode);
      state.mediaSource.disconnect(state.analyzerNode);

      await state.audioContext?.close();

      state.audioContext = null;
      state.analyzerNode = null;
      state.delayNode = null;
      state.mediaSource = null;
      state.gainNode = null;
      state.getByteFrequencyData = null;
      state.historicalBassFrequencies = [];
      state.historicalWideFrequencies = [];
    },
    async play() {
      await connect();
      await audioElement.play();
    },
    pause() {
      audioElement.pause();
    },
    seekToMs(ms) {
      if (Math.abs(audioElement.currentTime - ms / 1000) > 0.05) {
        audioElement.currentTime = ms / 1000;
      }
    },
    getCurrentTimeMs() {
      return audioElement.currentTime * 1000;
    },
    setVolume(volume) {
      if (volume < 0 || volume > 1) {
        throw new Error(`Volume must be between 0 and 1. Received ${volume}.`);
      }

      state.volume = volume;

      if (state.gainNode) {
        state.gainNode.gain.value = volume;
      }
    },
    getVolume() {
      return state.gainNode?.gain.value ?? state.volume;
    },
    setMaxMagnitudes(values) {
      state.bassMaxMagnitude = values.bass;
      state.wideMaxMagnitude = values.wide;
    },
    getCurrentBassFrequency() {
      return getCurrentFrequency("bass");
    },
    getCurrentWideFrequency() {
      return getCurrentFrequency("wide");
    },
    getHistoricalBassFrequencies(includeNextFrame = true) {
      return getHistoricalFrequencies("bass", includeNextFrame);
    },
    getHistoricalWideFrequencies(includeNextFrame = true) {
      return getHistoricalFrequencies("wide", includeNextFrame);
    },
    getWaveformSlice(startMs, endMs, targetPoints) {
      if (!waveform) {
        throw new Error(
          "Realtime audio analysis controller is missing waveform overview. Provide waveform to enable timeline slicing.",
        );
      }

      return sliceWaveformOverview(waveform, startMs, endMs, targetPoints);
    },
    getSpectrumAtFrame(frame) {
      const timeMs = (frame / state.fps) * 1000;
      return this.getSpectrumAtTimeMs(timeMs);
    },
    getSpectrumAtTimeMs(timeMs) {
      getConnectedState();
      assertRealtimeTime(timeMs);
      return new Float32Array(getCurrentFrequency("wide"));
    },
  };
}
