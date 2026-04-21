/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Audio/helpers/WindowingFunctions.js
 * 已迁移为 TS。
 */

export function createRectangularWindow(fftSize: number): Float32Array {
  return new Float32Array(fftSize).fill(1);
}

export function createHannWindow(fftSize: number): Float32Array {
  const windowValues = new Float32Array(fftSize);

  for (let index = 0; index < fftSize; index += 1) {
    windowValues[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (fftSize - 1)));
  }

  return windowValues;
}

export function createHammingWindow(fftSize: number): Float32Array {
  const windowValues = new Float32Array(fftSize);

  for (let index = 0; index < fftSize; index += 1) {
    windowValues[index] = 0.54 - 0.46 * Math.cos((2 * Math.PI * index) / (fftSize - 1));
  }

  return windowValues;
}

export function createBlackmanWindow(fftSize: number): Float32Array {
  const windowValues = new Float32Array(fftSize);
  const alpha = 0.16;
  const a0 = 0.5 * (1 - alpha);
  const a1 = 0.5;
  const a2 = 0.5 * alpha;

  for (let index = 0; index < fftSize; index += 1) {
    const x = index / fftSize;
    windowValues[index] =
      a0 - a1 * Math.cos(2 * Math.PI * x) + a2 * Math.cos(4 * Math.PI * x);
  }

  return windowValues;
}

export function createFlatTopWindow(fftSize: number): Float32Array {
  const a0 = 1.0;
  const a1 = 1.93;
  const a2 = 1.29;
  const a3 = 0.388;
  const a4 = 0.028;
  const windowValues = new Float32Array(fftSize);

  for (let index = 0; index < fftSize; index += 1) {
    windowValues[index] =
      a0 -
      a1 * Math.cos((2 * Math.PI * index) / (fftSize - 1)) +
      a2 * Math.cos((4 * Math.PI * index) / (fftSize - 1)) -
      a3 * Math.cos((6 * Math.PI * index) / (fftSize - 1)) +
      a4 * Math.cos((8 * Math.PI * index) / (fftSize - 1));
  }

  return windowValues;
}
