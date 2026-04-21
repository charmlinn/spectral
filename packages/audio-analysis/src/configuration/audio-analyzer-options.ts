/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Audio/configuration/AudioAnalyzerOptions.js
 * 已迁移为 TS。
 */

export const AUDIO_ANALYZER_OPTIONS = {
  fftSize: 1024 * 8,
  smoothingTime: 0.1,
  minDecibels: -100,
  maxDecibels: 0,
  clearFrequencyMaxLength: 1024,
} as const;

export const BASS_SPECTRUM_OPTIONS = {
  spectrumStart: 3,
  spectrumEnd: 26,
  exponent: 10,
  root: 1,
  magnitudeTargetMax: 32,
  baseBarCount: 200,
} as const;

export const WIDE_SPECTRUM_OPTIONS = {
  spectrumStart: 0,
  spectrumEnd: 225,
  exponent: 5,
  root: 2,
  magnitudeTargetMax: 150,
  baseBarCount: 200,
} as const;
