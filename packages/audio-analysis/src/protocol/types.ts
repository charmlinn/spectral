export type WaveformPoint = {
  min: number;
  max: number;
};

export type WaveformOverview = {
  durationMs: number;
  sampleRate: number;
  samplesPerPoint: number;
  points: WaveformPoint[];
};

export type SpectrumFrame = {
  frame: number;
  timeMs: number;
  values: Float32Array;
};

export type AudioAnalysisMagnitudes = {
  bass: number;
  wide: number;
};

export type AudioAnalysisSnapshot = {
  createdAt: string;
  fps: number;
  waveform: WaveformOverview;
  bassSpectrumFrames: SpectrumFrame[];
  wideSpectrumFrames: SpectrumFrame[];
  magnitudes: AudioAnalysisMagnitudes;
};

export type AudioAnalysisProvider = {
  getWaveformSlice(
    startMs: number,
    endMs: number,
    targetPoints?: number,
  ): WaveformOverview;
  getSpectrumAtFrame(frame: number): Float32Array;
  getSpectrumAtTimeMs(timeMs: number): Float32Array;
  getCurrentBassFrequency(timeMs?: number): ArrayLike<number>;
  getCurrentWideFrequency(timeMs?: number): ArrayLike<number>;
  getHistoricalBassFrequencies(timeMs?: number, includeNextFrame?: boolean): number[][];
  getHistoricalWideFrequencies(timeMs?: number, includeNextFrame?: boolean): number[][];
};
