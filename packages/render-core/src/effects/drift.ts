import type { DriftSettings } from "@spectral/project-schema";

import { SimplexNoise } from "./simplex-noise";

const driftNoise = new SimplexNoise(42);
const DEG_TO_RAD = Math.PI / 180;
const SPECTRUM_MAGNITUDE_DIVISOR = 20;
const ACCEL_SPEED_RANGE = 20;

type DriftAnchor = {
  t: number;
  amplitudeX: number;
  amplitudeY: number;
  rotation: number;
  speed: number;
  scale: number;
  acceleration: number;
};

const VISUALIZER_ANCHORS: DriftAnchor[] = [
  { t: 0, amplitudeX: 0, amplitudeY: 0, rotation: 0, speed: 0, scale: 0, acceleration: 0 },
  { t: 33, amplitudeX: 5, amplitudeY: 5, rotation: 0.5, speed: 1, scale: 0.3, acceleration: 50 },
  { t: 66, amplitudeX: 15, amplitudeY: 15, rotation: 1.5, speed: 0.35, scale: 0.5, acceleration: 25 },
  { t: 100, amplitudeX: 25, amplitudeY: 25, rotation: 2.5, speed: 0.5, scale: 0.75, acceleration: 10 },
] as const;

const BACKGROUND_ANCHORS: DriftAnchor[] = [
  { t: 0, amplitudeX: 0, amplitudeY: 0, rotation: 0, speed: 0, scale: 0, acceleration: 0 },
  { t: 33, amplitudeX: 5, amplitudeY: 5, rotation: 0.5, speed: 1.5, scale: 0.5, acceleration: 5 },
  { t: 66, amplitudeX: 25, amplitudeY: 25, rotation: 5, speed: 0.4, scale: 0, acceleration: 30 },
  { t: 100, amplitudeX: 50, amplitudeY: 50, rotation: 10, speed: 0.5, scale: 0, acceleration: 50 },
] as const;

export type DriftTransform = {
  translateX: number;
  translateY: number;
  rotationRad: number;
  scale: number;
};

type ResolveDriftKind = "visualizer" | "backdrop" | "text";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, factor: number) {
  return start + (end - start) * factor;
}

function interpolateAnchors(anchors: readonly DriftAnchor[], intensity: number): DriftAnchor {
  if (intensity <= 0) {
    return anchors[0]!;
  }

  if (intensity >= 100) {
    return anchors[anchors.length - 1]!;
  }

  let lower = anchors[0]!;
  let upper = anchors[anchors.length - 1]!;

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const left = anchors[index]!;
    const right = anchors[index + 1]!;

    if (intensity >= left.t && intensity <= right.t) {
      lower = left;
      upper = right;
      break;
    }
  }

  const factor = (intensity - lower.t) / Math.max(1, upper.t - lower.t);

  return {
    t: intensity,
    amplitudeX: lerp(lower.amplitudeX, upper.amplitudeX, factor),
    amplitudeY: lerp(lower.amplitudeY, upper.amplitudeY, factor),
    rotation: lerp(lower.rotation, upper.rotation, factor),
    speed: lerp(lower.speed, upper.speed, factor),
    scale: lerp(lower.scale, upper.scale, factor),
    acceleration: lerp(lower.acceleration, upper.acceleration, factor),
  };
}

export function resolveDriftSettings(
  drift: DriftSettings | null | undefined,
  kind: ResolveDriftKind,
): DriftSettings | null {
  if (!drift || !drift.enabled) {
    return null;
  }

  if (drift.customMode || kind === "text") {
    return drift;
  }

  const anchors = kind === "backdrop" ? BACKGROUND_ANCHORS : VISUALIZER_ANCHORS;
  const preset = interpolateAnchors(anchors, drift.intensity ?? 0);

  return {
    ...drift,
    ...preset,
    enabled: drift.enabled,
  };
}

function sampleNoise(time: number, frequency: number, lane: number) {
  return driftNoise.noise2D(time * frequency, lane * frequency);
}

function sampleFractalNoise(time: number, drift: DriftSettings) {
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let weightSum = 0;

  for (let octave = 0; octave < Math.max(1, drift.octaves); octave += 1) {
    const frequency = 2 ** octave;
    const weight = 0.5 ** octave;
    weightSum += weight;
    offsetX += sampleNoise(time, frequency, 11) * weight;
    offsetY += sampleNoise(time, frequency, 13) * weight;
    rotation += sampleNoise(time, frequency, 7) * weight;
  }

  return {
    offsetX: (offsetX / Math.max(weightSum, 1e-6)) * drift.amplitudeX,
    offsetY: (offsetY / Math.max(weightSum, 1e-6)) * drift.amplitudeY,
    rotationDeg: (rotation / Math.max(weightSum, 1e-6)) * drift.rotation,
  };
}

function computeEdgeCoverScale(
  width: number,
  height: number,
  translateX: number,
  translateY: number,
  rotationRad: number,
): number {
  if (width <= 0 || height <= 0) {
    return 1;
  }

  let scale = 1;
  const normalizedAngle = rotationRad - Math.PI * Math.floor(rotationRad / Math.PI);

  if (normalizedAngle !== 0) {
    const sin = Math.sin(normalizedAngle);
    const cos = Math.cos(normalizedAngle);
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    scale = 2 * Math.max(
      Math.abs(halfWidth * cos - halfHeight * sin) / width,
      Math.abs(halfWidth * sin + halfHeight * cos) / height,
      Math.abs(-halfWidth * cos - halfHeight * sin) / width,
      Math.abs(-halfWidth * sin + halfHeight * cos) / height,
    );
  }

  scale *= Math.max(
    (2 * Math.abs(translateX) + width) / width,
    (2 * Math.abs(translateY) + height) / height,
  );

  return Math.max(1, scale);
}

export function computeDriftTransform(input: {
  drift: DriftSettings | null | undefined;
  kind: ResolveDriftKind;
  timeMs: number;
  spectrumMagnitude?: number;
  width: number;
  height: number;
}): DriftTransform | null {
  const drift = resolveDriftSettings(input.drift, input.kind);

  if (!drift?.enabled) {
    return null;
  }

  const audioLevel = clamp((input.spectrumMagnitude ?? 0) / SPECTRUM_MAGNITUDE_DIVISOR, 0, 1);
  const speedMultiplier = 1 + (clamp(drift.acceleration, 0, 100) / 100) * audioLevel * ACCEL_SPEED_RANGE;
  const time = (input.timeMs / 1000) * Math.max(0, drift.speed) * Math.max(0, speedMultiplier);
  const sampled = sampleFractalNoise(time, drift);
  const rotationRad = sampled.rotationDeg * DEG_TO_RAD;
  const edgeCoverScale = computeEdgeCoverScale(
    input.width,
    input.height,
    sampled.offsetX,
    sampled.offsetY,
    rotationRad,
  );
  const audioScale = 1 + Math.max(0, drift.scale) * audioLevel;

  return {
    translateX: sampled.offsetX,
    translateY: sampled.offsetY,
    rotationRad,
    scale: Math.max(edgeCoverScale, audioScale),
  };
}
