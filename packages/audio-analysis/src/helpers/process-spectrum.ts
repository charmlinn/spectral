/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Preview/ProcessSpectrum.js
 * 已迁移为 TS。
 */

export type ProcessSpectrumOptions = {
  maxShiftPasses?: number;
  smoothed?: boolean;
  smoothingPasses?: number;
  smoothingPoints?: number;
  loop?: boolean;
  barCount?: number;
};

export function processSpectrum(
  spectrum: number[],
  options: ProcessSpectrumOptions,
): number[] {
  let nextSpectrum = spectrum.slice();
  const maxShiftPasses = options.maxShiftPasses ?? 0;
  const smoothed = options.smoothed ?? false;
  const smoothingPasses = options.smoothingPasses ?? 0;
  const smoothingPoints = options.smoothingPoints ?? 0;
  const loop = options.loop ?? false;

  nextSpectrum = maxShift(nextSpectrum, maxShiftPasses);
  if (smoothed) {
    nextSpectrum = smooth(
      nextSpectrum,
      smoothingPasses,
      smoothingPoints,
      loop,
    );
  }
  if (options.barCount) {
    nextSpectrum = conformToBarCount(nextSpectrum, options.barCount);
  }

  return nextSpectrum;
}

export function getSpectrumMagnitude(spectrum: number[]): number {
  const spectrumSum = spectrum.reduce((sum, value) => sum + value, 0);
  return spectrumSum / spectrum.length;
}

export function doubleFrames(inputFrames: number[][]): number[][] {
  const interpolatedFrames: number[][] = [];

  if (!inputFrames.length) {
    return interpolatedFrames;
  }

  for (let index = 0; index < inputFrames.length; index += 1) {
    const currentFrame = inputFrames[index] ?? [];
    const nextFrame = inputFrames[index + 1];

    if (!nextFrame) {
      interpolatedFrames.push(currentFrame);
      interpolatedFrames.push(currentFrame);
      break;
    }

    const middleFrame: number[] = [];

    for (let valueIndex = 0; valueIndex < currentFrame.length; valueIndex += 1) {
      middleFrame.push(((currentFrame[valueIndex] ?? 0) + (nextFrame[valueIndex] ?? 0)) / 2);
    }

    interpolatedFrames.push(currentFrame);
    interpolatedFrames.push(middleFrame);
  }

  return interpolatedFrames;
}

function maxShift(values: number[], maxShiftPasses: number): number[] {
  let nextValues = values.slice();
  const length = nextValues.length;

  for (let index = 0; index < maxShiftPasses; index += 1) {
    nextValues = conformToBarCount(nextValues, length * 2 + 1);
    nextValues = conformToBarCountMax(nextValues, length);
  }

  return nextValues;
}

function conformToBarCount(values: number[], target: number): number[] {
  const nextValues: number[] = [];
  const multiplier = (values.length - 1) / (target - 1);

  for (let index = 0; index < target - 1; index += 1) {
    const point = index * multiplier;
    const part1 = (values[Math.floor(point)] ?? 0) * Math.abs((point % 1) - 1);
    const part2 = (values[Math.ceil(point)] ?? 0) * (point % 1);
    nextValues.push(part1 + part2);
  }

  nextValues.push(values[values.length - 1] ?? 0);

  return nextValues;
}

function conformToBarCountMax(values: number[], target: number): number[] {
  const nextValues: number[] = [];
  const multiplier = (values.length - 1) / (target - 1);

  for (let index = 0; index < target - 1; index += 1) {
    const point = index * multiplier;
    nextValues.push(
      Math.max(values[Math.floor(point)] ?? 0, values[Math.ceil(point)] ?? 0),
    );
  }

  nextValues.push(values[values.length - 1] ?? 0);

  return nextValues;
}

function smooth(
  values: number[],
  smoothingPasses: number,
  smoothingPoints: number,
  loop = true,
): number[] {
  let lastArray = values;
  let nextArray = values;

  for (let pass = 0; pass < smoothingPasses; pass += 1) {
    const sidePoints = Math.floor(smoothingPoints / 2);
    const coefficient = 1 / ((2 * sidePoints) + 1);
    nextArray = [];

    for (let index = 0; index < lastArray.length; index += 1) {
      let sum = 0;

      for (let offset = -sidePoints; offset <= sidePoints; offset += 1) {
        if (index + offset >= lastArray.length) {
          sum += loop
            ? coefficient * (lastArray[offset - 1] ?? 0)
            : coefficient * (lastArray[index] ?? 0);
        } else if (index + offset < 0) {
          sum += loop
            ? coefficient * (lastArray[lastArray.length + offset] ?? 0)
            : coefficient * (lastArray[index] ?? 0);
        } else {
          sum += coefficient * (lastArray[index + offset] ?? 0);
        }
      }

      nextArray[index] = sum;
    }

    lastArray = nextArray;
  }

  return nextArray;
}
