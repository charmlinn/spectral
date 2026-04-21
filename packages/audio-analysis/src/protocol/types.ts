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

export type AudioAnalysisSnapshot = {
  createdAt: string;
  fps: number;
  waveform: WaveformOverview;
  spectrumFrames: SpectrumFrame[];
};

export type AudioAnalysisProvider = {
  getWaveformSlice(startMs: number, endMs: number, targetPoints?: number): WaveformOverview;
  getSpectrumAtFrame(frame: number): Float32Array;
  getSpectrumAtTimeMs(timeMs: number): Float32Array;
};
