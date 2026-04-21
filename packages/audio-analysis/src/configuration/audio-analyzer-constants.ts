/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Audio/configuration/AudioAnalyzerConstants.js
 * 已迁移为 TS。
 */

export const AUDIO_ANALYZER_CONSTANTS = {
  historicalFrequenciesLimit: 7,
  maxMagnitudeCalculationPercentile: 0.05,
  maxMagnitudeAnalysisFps: 30,
  defaultBassMaxMagnitude: 250,
  defaultWideMaxMagnitude: 250,
} as const;

export const EMPTY_AUDIO_FREQUENCY = new Float32Array(200);
