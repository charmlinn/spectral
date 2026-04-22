import { processSpectrum } from "@spectral/audio-analysis";
import type { VisualizerWaveCircle } from "@spectral/project-schema";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  clamp,
  average,
  SPECTERR_BASS_BOUNCE_SCALE,
  SPECTERR_BASS_SHAKE_FACTOR_LITTLE,
  SPECTERR_BASS_SHAKE_FACTOR_LOT,
  SPECTERR_BASS_TARGET_MAX,
  SPECTERR_HISTORY_LIMIT,
  SPECTERR_WIDE_BOUNCE_SCALE,
  SPECTERR_WIDE_SHAKE_FACTOR_LITTLE,
  SPECTERR_WIDE_SHAKE_FACTOR_LOT,
  SPECTERR_WIDE_TARGET_MAX,
  toRadians,
} from "../canvas-utils";
import type { SpecterrWaveCircleRenderOptions } from "../specterr-visualizer-options";
import type {
  VisualizerConfig,
  VisualizerLayer,
  VisualizerRingRenderConfig,
} from "./types";

function normalizeVisualizerWaveType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "wide spectrum";

  if (normalized.includes("bass")) {
    return "bass spectrum";
  }

  if (normalized.includes("waveform")) {
    return "waveform";
  }

  return "wide spectrum";
}

export function averageSpectrumMagnitude(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return average(values);
}

function sampleDeterministicNoise(frame: number, lane: number) {
  const value = Math.sin(frame * 12.9898 + lane * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function computeVisualizerShakeOffset(
  frame: number,
  amplitude: number,
  strength: number,
) {
  const factor = clamp(amplitude / 255, 0, 1);

  return {
    x: (sampleDeterministicNoise(frame, 1) - 0.5) * strength * factor,
    y: (sampleDeterministicNoise(frame, 2) - 0.5) * strength * factor,
  };
}

export function getRingRotation(
  timeMs: number,
  index: number,
  baseRotation: number,
  bassAmplitude: number,
  spinSettings: VisualizerWaveCircle["spinSettings"],
) {
  if (!spinSettings.enabled) {
    return baseRotation;
  }

  const effectiveRpm =
    spinSettings.speed +
    Math.max(0, spinSettings.acceleration) * Math.max(0, bassAmplitude / 2);
  const turnsPerMs = effectiveRpm / 60000;

  return (
    baseRotation +
    timeMs * turnsPerMs * Math.PI * 2 * (index % 2 === 0 ? 1 : -1)
  );
}

export function getGlobalVisualizerSpinRotation(
  timeMs: number,
  bassAmplitude: number,
  spinSettings: VisualizerConfig["spinSettings"],
) {
  if (!spinSettings.enabled) {
    return 0;
  }

  const effectiveRpm =
    spinSettings.speed +
    Math.max(0, spinSettings.acceleration) * Math.max(0, bassAmplitude / 2);

  return timeMs * (effectiveRpm / 60000) * Math.PI * 2;
}

function getBassSpectrumSlice(spectrum: Float32Array) {
  return spectrum.slice(0, Math.max(12, Math.floor(spectrum.length * 0.18)));
}

function getSpectrumHistory(
  input: BrowserRenderAdapterRenderInput,
  waveType: string,
): number[][] {
  const historyProvider = (input.historyProvider ?? input.analysisProvider) as
    | ((typeof input.historyProvider | typeof input.analysisProvider) & {
        getHistoricalBassFrequencies?(includeNextFrame?: boolean): number[][];
        getHistoricalWideFrequencies?(includeNextFrame?: boolean): number[][];
      })
    | null
    | undefined;
  const fallbackProvider = input.analysisProvider ?? input.historyProvider;
  const normalizedWaveType = normalizeVisualizerWaveType(waveType);

  if (normalizedWaveType.includes("bass")) {
    try {
      if (historyProvider?.getHistoricalBassFrequencies) {
        return historyProvider.getHistoricalBassFrequencies(true);
      }
    } catch {
      // Fall back to frame-based history when realtime history is unavailable.
    }

    const history: number[][] = [];

    for (
      let frameDelay = 0;
      frameDelay < SPECTERR_HISTORY_LIMIT;
      frameDelay += 1
    ) {
      const frame = Math.max(0, input.frameContext.frame - frameDelay);
      const spectrum = fallbackProvider?.getSpectrumAtFrame(frame);
      history.push(
        Array.from(getBassSpectrumSlice(spectrum ?? new Float32Array())),
      );
    }

    return history;
  }

  try {
    if (historyProvider?.getHistoricalWideFrequencies) {
      return historyProvider.getHistoricalWideFrequencies(true);
    }
  } catch {
    // Fall back to frame-based history when realtime history is unavailable.
  }

  const history: number[][] = [];

  for (
    let frameDelay = 0;
    frameDelay < SPECTERR_HISTORY_LIMIT;
    frameDelay += 1
  ) {
    const frame = Math.max(0, input.frameContext.frame - frameDelay);
    const spectrum = fallbackProvider?.getSpectrumAtFrame(frame);
    history.push(Array.from(spectrum ?? new Float32Array()));
  }

  return history;
}

export function getSpectrumForVisualizer(
  layer: VisualizerLayer,
  input: BrowserRenderAdapterRenderInput,
  ringOptions: SpecterrWaveCircleRenderOptions,
  waveType: string,
) {
  const normalizedWaveType = normalizeVisualizerWaveType(waveType);
  const spectrumHistory = getSpectrumHistory(input, normalizedWaveType);
  const targetSpectrum =
    spectrumHistory[ringOptions.frameDelay] ??
    spectrumHistory[0] ??
    Array.from(
      normalizedWaveType.includes("bass")
        ? layer.props.bassSpectrum
        : layer.props.spectrum,
    );

  return processSpectrum(targetSpectrum, ringOptions.spectrumOptions);
}

export function getVisualizerRingStyle(
  layer: VisualizerLayer,
  ringIndex: number,
): VisualizerWaveCircle {
  const ring = layer.props.config.waveCircles[ringIndex];

  if (ring) {
    return ring;
  }

  return {
    fillColor: "0xffffff",
    secondaryFillColor: "0xffffff",
    lineColor: "0xffffff",
    secondaryLineColor: "0xffffff",
    fillAlpha: 0.2,
    secondaryFillAlpha: 0.1,
    lineWidth: 2,
    lineAlpha: 1,
    secondaryLineAlpha: 0.6,
    visible: true,
    spinSettings: {
      enabled: false,
      speed: 0,
      acceleration: 0,
      logoLocked: false,
    },
    customOptions: {},
  };
}

export function resolveVisualizerRingRenderConfig(
  config: VisualizerConfig,
  ring: VisualizerWaveCircle,
): VisualizerRingRenderConfig {
  const customOptions = ring.customOptions as Record<string, unknown>;
  const customEnabled = customOptions.enabled === true;

  return {
    barWidth:
      customEnabled && typeof customOptions.barWidth === "number"
        ? customOptions.barWidth
        : config.barWidth,
    inverted:
      customEnabled && typeof customOptions.inverted === "boolean"
        ? customOptions.inverted
        : config.inverted,
    pointRadius:
      customEnabled && typeof customOptions.pointRadius === "number"
        ? customOptions.pointRadius
        : config.pointRadius,
    reflectionType:
      customEnabled && typeof customOptions.reflectionType === "string"
        ? customOptions.reflectionType
        : config.reflectionType,
    rotationRad:
      customEnabled && typeof customOptions.rotation === "number"
        ? toRadians(customOptions.rotation)
        : 0,
    waveType:
      customEnabled && typeof customOptions.waveType === "string"
        ? customOptions.waveType
        : config.waveType,
    waveStyle:
      customEnabled && typeof customOptions.waveStyle === "string"
        ? customOptions.waveStyle
        : config.waveStyle,
  };
}

export function getVisualizerTargetMax(waveType: string) {
  const normalized = normalizeVisualizerWaveType(waveType);

  if (normalized.includes("bass")) {
    return SPECTERR_BASS_TARGET_MAX;
  }

  if (normalized.includes("wide")) {
    return SPECTERR_WIDE_TARGET_MAX;
  }

  return 255;
}

export function getVisualizerBounceScale(
  spectrumMagnitude: number,
  waveType: string,
  bounceFactor: number,
) {
  const normalizedWaveType = normalizeVisualizerWaveType(waveType);
  const baseScale = normalizedWaveType.includes("bass")
    ? SPECTERR_BASS_BOUNCE_SCALE
    : SPECTERR_WIDE_BOUNCE_SCALE;

  return 1 + (clamp(spectrumMagnitude, 0, 255) / 255) * baseScale * bounceFactor;
}

export function getVisualizerShakeFactor(
  shakeAmount: string,
  waveType: string,
) {
  const normalizedWaveType = normalizeVisualizerWaveType(waveType);
  const normalizedShake = shakeAmount.toLowerCase();

  if (normalizedShake === "none") {
    return 0;
  }

  if (normalizedWaveType.includes("bass")) {
    return normalizedShake === "lot"
      ? SPECTERR_BASS_SHAKE_FACTOR_LOT
      : SPECTERR_BASS_SHAKE_FACTOR_LITTLE;
  }

  return normalizedShake === "lot"
    ? SPECTERR_WIDE_SHAKE_FACTOR_LOT
    : SPECTERR_WIDE_SHAKE_FACTOR_LITTLE;
}
