/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Audio/helpers/AudioAnalyzerFFT.js
 * 已迁移为 TS。
 *
 * The old implementation delegated FFT work to `fft.js`.
 * This package keeps the public behavior but uses a bundled real-signal DFT fallback
 * so the package can exist without root-level dependency changes.
 */

import { createBlackmanWindow } from "./windowing-functions";

function linearToDecibel(linear: number): number {
  if (!linear) {
    return -1000;
  }

  return 20 * Math.log10(linear);
}

function getByteValue(value: number, minDecibels = -100, maxDecibels = -10): number {
  const ucharMax = 255;
  const rangeScaleFactor =
    minDecibels === maxDecibels ? 1 : 1 / (maxDecibels - minDecibels);

  const dbMagnitude = !value ? minDecibels : linearToDecibel(value);
  let scaledValue = ucharMax * (dbMagnitude - minDecibels) * rangeScaleFactor;

  if (scaledValue < 0) {
    scaledValue = 0;
  }

  if (scaledValue > ucharMax) {
    scaledValue = ucharMax;
  }

  return scaledValue;
}

function performRealDft(inputValues: Float64Array): Float64Array {
  const fftSize = inputValues.length;
  const outputValues = new Float64Array(fftSize * 2);

  for (let frequencyIndex = 0; frequencyIndex < fftSize; frequencyIndex += 1) {
    let realValue = 0;
    let imaginaryValue = 0;

    for (let sampleIndex = 0; sampleIndex < fftSize; sampleIndex += 1) {
      const angle = (-2 * Math.PI * frequencyIndex * sampleIndex) / fftSize;
      const sample = inputValues[sampleIndex] ?? 0;

      realValue += sample * Math.cos(angle);
      imaginaryValue += sample * Math.sin(angle);
    }

    outputValues[2 * frequencyIndex] = realValue;
    outputValues[(2 * frequencyIndex) + 1] = imaginaryValue;
  }

  return outputValues;
}

export type ByteFrequencyAnalyzer = (
  timeDomainData: Float32Array,
  frequencyBinCount: number,
) => Float32Array;

export function createFFTAnalyzer(
  fftSize: number,
  minDecibels: number,
  maxDecibels: number,
  smoothingTimeConstant: number,
): ByteFrequencyAnalyzer {
  const windowValues = createBlackmanWindow(fftSize);
  const inputValues = new Float64Array(fftSize);
  const magnitudesLength = fftSize / 2;
  const magnitudes = new Float32Array(magnitudesLength);
  const magnitudeScale = 1 / fftSize;

  return function getByteFrequencyData(
    timeDomainData: Float32Array,
    frequencyBinCount: number,
  ): Float32Array {
    for (let index = 0; index < fftSize; index += 1) {
      inputValues[index] = (timeDomainData[index] ?? 0) * (windowValues[index] ?? 0);
    }

    const outputValues = performRealDft(inputValues);

    for (let index = 0; index < magnitudesLength; index += 1) {
      const realValue = outputValues[2 * index] ?? 0;
      const imaginaryValue = outputValues[(2 * index) + 1] ?? 0;
      const scalarMagnitude =
        Math.sqrt(realValue * realValue + imaginaryValue * imaginaryValue) * magnitudeScale;

      magnitudes[index] =
        (smoothingTimeConstant * (magnitudes[index] ?? 0)) +
        ((1 - smoothingTimeConstant) * scalarMagnitude);
    }

    const byteFrequencyData = new Float32Array(frequencyBinCount);

    for (
      let index = 0;
      index < frequencyBinCount && index < magnitudesLength;
      index += 1
    ) {
      byteFrequencyData[index] = getByteValue(
        magnitudes[index] ?? 0,
        minDecibels,
        maxDecibels,
      );
    }

    return byteFrequencyData;
  };
}
