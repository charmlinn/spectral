const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function mulberry32(seed: number) {
  let nextSeed = seed;

  return () => {
    nextSeed |= 0;
    nextSeed = (nextSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(nextSeed ^ (nextSeed >>> 15), 1 | nextSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimplexNoise {
  readonly #perm = new Uint8Array(512);
  readonly #permMod12 = new Uint8Array(512);
  readonly #grad3 = new Float32Array([
    1, 1, 0,
    -1, 1, 0,
    1, -1, 0,
    -1, -1, 0,
    1, 0, 1,
    -1, 0, 1,
    1, 0, -1,
    -1, 0, -1,
    0, 1, 1,
    0, -1, 1,
    0, 1, -1,
    0, -1, -1,
  ]);

  constructor(seed = 42) {
    const rng = mulberry32(seed);
    const values = new Uint8Array(256);

    for (let index = 0; index < 256; index += 1) {
      values[index] = Math.floor(rng() * 256);
    }

    for (let index = 0; index < 512; index += 1) {
      this.#perm[index] = values[index & 255] ?? 0;
      this.#permMod12[index] = (this.#perm[index] ?? 0) % 12;
    }
  }

  noise2D(xInput: number, yInput: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    const skew = (xInput + yInput) * F2;
    const i = Math.floor(xInput + skew);
    const j = Math.floor(yInput + skew);
    const unskew = (i + j) * G2;

    const x0 = xInput - (i - unskew);
    const y0 = yInput - (j - unskew);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = i1 === 1 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;

    if (t0 >= 0) {
      const gradientIndex = (this.#permMod12[ii + (this.#perm[jj] ?? 0)] ?? 0) * 3;
      t0 *= t0;
      n0 =
        t0 * t0 * (((this.#grad3[gradientIndex] ?? 0) * x0) + ((this.#grad3[gradientIndex + 1] ?? 0) * y0));
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;

    if (t1 >= 0) {
      const gradientIndex = (this.#permMod12[ii + i1 + (this.#perm[jj + j1] ?? 0)] ?? 0) * 3;
      t1 *= t1;
      n1 =
        t1 * t1 * (((this.#grad3[gradientIndex] ?? 0) * x1) + ((this.#grad3[gradientIndex + 1] ?? 0) * y1));
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;

    if (t2 >= 0) {
      const gradientIndex = (this.#permMod12[ii + 1 + (this.#perm[jj + 1] ?? 0)] ?? 0) * 3;
      t2 *= t2;
      n2 =
        t2 * t2 * (((this.#grad3[gradientIndex] ?? 0) * x2) + ((this.#grad3[gradientIndex + 1] ?? 0) * y2));
    }

    return 70 * (n0 + n1 + n2);
  }
}
