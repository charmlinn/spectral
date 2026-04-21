/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Audio/helpers/AudioAnalyzerCalculations.js
 * 已迁移为 TS。
 */

export function decorateAudioFrequency(
  spectrumFrequency: number[],
  magnitudeTargetMax: number,
  exponent: number,
  root: number,
  baseBarCount: number,
  cumulativeMaxMagnitude: number,
): number[] {
  const targetMax = magnitudeTargetMax;
  const magnitudeMultiplier = targetMax / cumulativeMaxMagnitude;

  for (let index = 0; index < spectrumFrequency.length; index += 1) {
    const normalizedBin = (spectrumFrequency[index] ?? 0) * magnitudeMultiplier;
    spectrumFrequency[index] = normalizedBin <= targetMax ? normalizedBin : targetMax;
  }

  if (exponent > 1) {
    const divisor = Math.pow(targetMax, exponent - 1);

    for (let index = 0; index < spectrumFrequency.length; index += 1) {
      spectrumFrequency[index] =
        Math.pow(spectrumFrequency[index] ?? 0, exponent) / divisor;
    }
  }

  if (root > 1) {
    const inverseExponent = 1 / root;
    const multiplier = Math.pow(Math.pow(targetMax, inverseExponent), root - 1);

    for (let index = 0; index < spectrumFrequency.length; index += 1) {
      spectrumFrequency[index] =
        Math.pow(spectrumFrequency[index] ?? 0, inverseExponent) * multiplier;
    }
  }

  return conformToBarCount(spectrumFrequency, baseBarCount);
}

export function calculateCumulativeMaxMagnitude(
  magnitudes: number[] | undefined,
  percentile: number,
): number | undefined {
  if (!magnitudes) {
    return undefined;
  }

  if (magnitudes.length <= 1) {
    return magnitudes[0];
  }

  magnitudes.sort((left, right) => right - left);

  const maxValuesCount = Math.floor(magnitudes.length * percentile);

  if (maxValuesCount <= 0) {
    return magnitudes[0];
  }

  const maxValues = magnitudes.slice(0, maxValuesCount);
  const sum = maxValues.reduce((total, current) => total + current, 0);
  const average = sum / maxValues.length;

  return Number.parseFloat(average.toFixed(3));
}

function conformToBarCount(values: number[], target: number): number[] {
  const resampled: number[] = [];
  const multiplier = (values.length - 1) / (target - 1);

  for (let index = 0; index < target - 1; index += 1) {
    const point = index * multiplier;
    const part1 = (values[Math.floor(point)] ?? 0) * Math.abs((point % 1) - 1);
    const part2 = (values[Math.ceil(point)] ?? 0) * (point % 1);

    resampled.push(part1 + part2);
  }

  resampled.push(values[values.length - 1] ?? 0);

  return resampled;
}
