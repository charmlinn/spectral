import { computeDriftTransform, type RenderAssetResolver } from "@spectral/render-core";
import type { VisualizerWaveCircle } from "@spectral/project-schema";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  drawMediaCover,
  resolveLoadedMedia,
  syncVideoFrame,
  type MediaCache,
} from "../canvas-media";
import {
  average,
  clamp,
  getReflectionAngles,
  mixColor,
  SPECTERR_VISUALIZER_BASE_HEIGHT,
  SPECTERR_VISUALIZER_BASE_RADIUS,
  toColorString,
  toRadians,
} from "../canvas-utils";
import {
  createSpecterrWaveCircleOptions,
  type SpecterrWaveCircleRenderOptions,
} from "../specterr-visualizer-options";
import {
  averageSpectrumMagnitude,
  advanceVisualizerShakeOffset,
  getGlobalVisualizerSpinRotation,
  getRingRotation,
  getSpectrumForVisualizer,
  getVisualizerBounceScale,
  getVisualizerRingStyle,
  getVisualizerShakeFactor,
  getVisualizerTargetMax,
  resolveVisualizerRingRenderConfig,
} from "./behavior";
import {
  buildCircleBarPointSets,
  buildCircleWavePoints,
  buildFlatWaveBars,
  buildFlatWavePoints,
} from "./geometry";
import type {
  VisualizerBufferStore,
  VisualizerLayer,
  VisualizerRingRenderConfig,
  VisualizerShapeRenderInput,
  VisualizerTransform,
} from "./types";

export function createVisualizerBufferStore(): VisualizerBufferStore {
  return {
    composite: null,
    glow: null,
    main: null,
    shakeOffset: { x: 0, y: 0 },
  };
}

function ensureBuffer(
  canvas: HTMLCanvasElement | null,
  surface: BrowserRenderAdapterRenderInput["surface"],
) {
  const buffer = canvas ?? document.createElement("canvas");
  const width = Math.max(1, Math.round(surface.width * surface.dpr));
  const height = Math.max(1, Math.round(surface.height * surface.dpr));

  if (buffer.width !== width || buffer.height !== height) {
    buffer.width = width;
    buffer.height = height;
  }

  return buffer;
}

function prepareBufferContext(
  buffer: HTMLCanvasElement,
  surface: BrowserRenderAdapterRenderInput["surface"],
) {
  const context = buffer.getContext("2d");

  if (!context) {
    throw new Error("Failed to acquire visualizer buffer context.");
  }

  context.setTransform(surface.dpr, 0, 0, surface.dpr, 0, 0);
  context.clearRect(0, 0, surface.width, surface.height);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
  context.shadowColor = "transparent";
  context.shadowBlur = 0;

  return context;
}

function withVisualizerTransform(
  context: CanvasRenderingContext2D,
  transform: VisualizerTransform,
  draw: () => void,
) {
  context.save();
  context.translate(transform.x, transform.y);
  context.rotate(transform.rotation);
  context.scale(transform.scale, transform.scale);
  draw();
  context.restore();
}

function drawCircleWave(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  radius: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
  ring: VisualizerWaveCircle,
  waveStyle: string,
) {
  const { points, magnitudePercents } = buildCircleWavePoints(
    spectrum,
    radius,
    reflectionType,
    inverted,
    targetMax,
    waveScale,
  );

  if (points.length < 4) {
    return;
  }

  context.beginPath();

  for (let index = 0; index < points.length; index += 2) {
    const x = points[index]!;
    const y = points[index + 1]!;

    if (index === 0) {
      context.moveTo(x, y);
      continue;
    }

    context.lineTo(x, y);
  }

  context.closePath();
  const mixPercent = clamp(average(magnitudePercents) * 5, 0, 1);
  context.fillStyle = mixColor(
    ring.fillColor,
    ring.secondaryFillColor,
    mixPercent,
    clamp(
      ring.fillAlpha * (1 - mixPercent) + ring.secondaryFillAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.strokeStyle = mixColor(
    ring.lineColor,
    ring.secondaryLineColor,
    mixPercent,
    clamp(
      ring.lineAlpha * (1 - mixPercent) + ring.secondaryLineAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.lineWidth = Math.max(1, ring.lineWidth);

  if (
    waveStyle === "solid" ||
    ring.fillAlpha > 0 ||
    ring.secondaryFillAlpha > 0
  ) {
    context.fill();
  }

  context.stroke();
}

function drawBarCircle(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  radius: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
  barWidth: number,
  ring: VisualizerWaveCircle,
) {
  const { pointSets, magnitudePercents } = buildCircleBarPointSets(
    spectrum,
    radius,
    reflectionType,
    inverted,
    targetMax,
    waveScale,
    barWidth,
  );

  for (let index = 0; index < pointSets.length; index += 1) {
    const pointSet = pointSets[index];

    if (!pointSet) {
      continue;
    }

    const mixPercent = magnitudePercents[index] ?? 0;
    context.fillStyle = mixColor(
      ring.fillColor,
      ring.secondaryFillColor,
      mixPercent,
      clamp(
        ring.fillAlpha * (1 - mixPercent) + ring.secondaryFillAlpha * mixPercent,
        0,
        1,
      ),
    );
    context.strokeStyle = mixColor(
      ring.lineColor,
      ring.secondaryLineColor,
      mixPercent,
      clamp(
        ring.lineAlpha * (1 - mixPercent) + ring.secondaryLineAlpha * mixPercent,
        0,
        1,
      ),
    );
    context.lineWidth = Math.max(1, ring.lineWidth);
    context.beginPath();
    context.moveTo(pointSet[0]!, pointSet[1]!);
    context.lineTo(pointSet[2]!, pointSet[3]!);
    context.lineTo(pointSet[4]!, pointSet[5]!);
    context.closePath();
    context.fill();
    context.stroke();
  }
}

function drawPointCircle(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  radius: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
  pointRadius: number,
  ring: VisualizerWaveCircle,
) {
  const { points, magnitudePercents } = buildCircleWavePoints(
    spectrum,
    radius,
    reflectionType,
    inverted,
    targetMax,
    waveScale,
  );
  const computedPointRadius = Math.max(1, pointRadius * 1.5);

  for (let index = 0; index < points.length - 1; index += 2) {
    const value = magnitudePercents[Math.floor(index / 2)] ?? 0;
    context.fillStyle = mixColor(
      ring.fillColor,
      ring.secondaryFillColor,
      value,
      clamp(
        ring.fillAlpha * (1 - value) + ring.secondaryFillAlpha * value,
        0,
        1,
      ),
    );
    context.strokeStyle = mixColor(
      ring.lineColor,
      ring.secondaryLineColor,
      value,
      clamp(
        ring.lineAlpha * (1 - value) + ring.secondaryLineAlpha * value,
        0,
        1,
      ),
    );
    context.lineWidth = Math.max(1, ring.lineWidth);
    context.beginPath();
    context.arc(
      points[index]!,
      points[index + 1]!,
      computedPointRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  }
}

function drawFlatWave(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  width: number,
  baseHeight: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveStyle: string,
  waveScale: number,
  barWidth: number,
  pointRadius: number,
  ring: VisualizerWaveCircle,
) {
  if (waveStyle === "bar") {
    const { pointSets, magnitudePercents } = buildFlatWaveBars(
      spectrum,
      width,
      baseHeight,
      reflectionType,
      inverted,
      targetMax,
      waveScale,
      barWidth,
    );

    for (let index = 0; index < pointSets.length; index += 1) {
      const pointSet = pointSets[index];

      if (!pointSet) {
        continue;
      }

      const mixPercent = magnitudePercents[index] ?? 0;
      context.fillStyle = mixColor(
        ring.fillColor,
        ring.secondaryFillColor,
        mixPercent,
        clamp(
          ring.fillAlpha * (1 - mixPercent) +
            ring.secondaryFillAlpha * mixPercent,
          0,
          1,
        ),
      );
      context.strokeStyle = mixColor(
        ring.lineColor,
        ring.secondaryLineColor,
        mixPercent,
        clamp(
          ring.lineAlpha * (1 - mixPercent) +
            ring.secondaryLineAlpha * mixPercent,
          0,
          1,
        ),
      );
      context.lineWidth = Math.max(1, ring.lineWidth);
      context.beginPath();
      context.rect(pointSet[0]!, pointSet[1]!, pointSet[2]!, pointSet[3]!);
      context.fill();
      context.stroke();
    }

    return;
  }

  const { points, magnitudePercents } = buildFlatWavePoints(
    spectrum,
    width,
    baseHeight,
    reflectionType,
    inverted,
    targetMax,
    waveScale,
    waveStyle,
  );

  if (points.length < 4) {
    return;
  }

  if (waveStyle === "point") {
    for (let index = 0; index < points.length - 1; index += 2) {
      const value = magnitudePercents[Math.floor(index / 2)] ?? 0;
      const x = points[index]!;
      const y = points[index + 1]!;
      context.fillStyle = mixColor(
        ring.fillColor,
        ring.secondaryFillColor,
        value,
        clamp(
          ring.fillAlpha * (1 - value) + ring.secondaryFillAlpha * value,
          0,
          1,
        ),
      );
      context.strokeStyle = mixColor(
        ring.lineColor,
        ring.secondaryLineColor,
        value,
        clamp(
          ring.lineAlpha * (1 - value) + ring.secondaryLineAlpha * value,
          0,
          1,
        ),
      );
      context.lineWidth = Math.max(1, ring.lineWidth);
      context.beginPath();
      context.arc(x, y, Math.max(1, pointRadius), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    return;
  }

  const mixPercent = clamp(average(magnitudePercents) * 5, 0, 1);
  context.beginPath();

  for (let index = 0; index < points.length; index += 2) {
    const x = points[index]!;
    const y = points[index + 1]!;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.fillStyle = mixColor(
    ring.fillColor,
    ring.secondaryFillColor,
    mixPercent,
    clamp(
      ring.fillAlpha * (1 - mixPercent) + ring.secondaryFillAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.strokeStyle = mixColor(
    ring.lineColor,
    ring.secondaryLineColor,
    mixPercent,
    clamp(
      ring.lineAlpha * (1 - mixPercent) + ring.secondaryLineAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.lineWidth = Math.max(1, ring.lineWidth);
  context.fill();
  context.stroke();
}

function renderVisualizerShape(input: VisualizerShapeRenderInput) {
  const targetMax = getVisualizerTargetMax(input.renderConfig.waveType);

  if (input.config.shape === "flat") {
    drawFlatWave(
      input.context,
      input.processedSpectrum,
      input.width,
      input.baseHeight,
      input.renderConfig.reflectionType,
      input.renderConfig.inverted,
      targetMax,
      input.renderConfig.waveStyle,
      input.waveCircleOption.waveScale,
      input.renderConfig.barWidth,
      input.renderConfig.pointRadius,
      input.ring,
    );
    return;
  }

  if (input.renderConfig.waveStyle === "bar") {
    drawBarCircle(
      input.context,
      input.processedSpectrum,
      input.radius,
      input.renderConfig.reflectionType,
      input.renderConfig.inverted,
      targetMax,
      input.waveCircleOption.waveScale,
      input.renderConfig.barWidth,
      input.ring,
    );
    return;
  }

  if (input.renderConfig.waveStyle === "point") {
    drawPointCircle(
      input.context,
      input.processedSpectrum,
      input.radius,
      input.renderConfig.reflectionType,
      input.renderConfig.inverted,
      targetMax,
      input.waveCircleOption.waveScale,
      input.renderConfig.pointRadius,
      input.ring,
    );
    return;
  }

  drawCircleWave(
    input.context,
    input.processedSpectrum,
    input.radius,
    input.renderConfig.reflectionType,
    input.renderConfig.inverted,
    targetMax,
    input.waveCircleOption.waveScale,
    input.ring,
    input.renderConfig.waveStyle,
  );
}

function drawShapeIntoLayer(
  context: CanvasRenderingContext2D,
  transform: VisualizerTransform,
  rotation: number,
  input: VisualizerShapeRenderInput,
) {
  withVisualizerTransform(context, transform, () => {
    context.rotate(rotation);
    renderVisualizerShape(input);
  });
}

function applyVisualizerCenterCutout(
  context: CanvasRenderingContext2D,
  config: VisualizerLayer["props"]["config"],
  transform: VisualizerTransform,
) {
  if (config.shape !== "circle") {
    return;
  }

  const cutoutRadius = clamp(config.centerCutoutFactor, 1, 99);

  if (cutoutRadius <= 0) {
    return;
  }

  withVisualizerTransform(context, transform, () => {
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(0, 0, cutoutRadius, 0, Math.PI * 2);
    context.fillStyle = "#000000";
    context.fill();
  });
}

function drawShadowPasses(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  surface: BrowserRenderAdapterRenderInput["surface"],
  color: string,
  blur: number,
  opacity: number,
) {
  const passes = [1, 1.35];

  for (const spread of passes) {
    context.save();
    context.shadowColor = toColorString(color, clamp(opacity, 0, 1));
    context.shadowBlur = Math.max(0, blur * spread);
    context.drawImage(source, 0, 0, surface.width, surface.height);
    context.restore();
  }
}

function drawGlowPasses(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  surface: BrowserRenderAdapterRenderInput["surface"],
  blur: number,
  scale: number,
  glowType: string,
) {
  const passes = Math.max(2, Math.min(4, Math.round(Math.max(1, scale * 2))));

  for (let pass = 0; pass < passes; pass += 1) {
    const passRatio = (pass + 1) / passes;
    context.save();
    context.globalCompositeOperation = "screen";
    context.globalAlpha =
      (glowType === "inner" ? 0.12 : 0.18) *
      scale *
      (1 - passRatio * 0.2);
    context.filter = `blur(${Math.max(0, blur) * (0.8 + passRatio * 1.2)}px)`;
    context.drawImage(source, 0, 0, surface.width, surface.height);
    context.restore();
  }
}

function drawFirePasses(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  surface: BrowserRenderAdapterRenderInput["surface"],
  timeMs: number,
  intensity: number,
  detail: number,
  scaleMultiplier: number,
) {
  if (intensity <= 0 || detail <= 0) {
    return;
  }

  const fireBlur = Math.max(4, intensity * 1.6 * scaleMultiplier);
  const layers = 3;

  for (let index = 0; index < layers; index += 1) {
    const progress = (index + 1) / layers;
    const shift =
      Math.sin(timeMs / 160 + index * 0.9) *
      Math.max(2, detail * 6 * scaleMultiplier) *
      progress;

    context.save();
    context.translate(
      Math.cos(timeMs / 280 + index * 0.4) * detail * 2 * progress,
      -shift - intensity * 2 * progress,
    );
    context.scale(1 + progress * 0.015, 1 + progress * 0.035);
    context.globalCompositeOperation = "screen";
    context.globalAlpha = clamp(0.08 + intensity * 0.03 * (1 - progress * 0.2), 0, 0.5);
    context.filter = `blur(${fireBlur * (0.75 + progress)}px) hue-rotate(-18deg) saturate(165%)`;
    context.shadowColor = "rgba(255, 132, 46, 0.8)";
    context.shadowBlur = fireBlur * (1.4 + progress * 0.8);
    context.drawImage(source, 0, 0, surface.width, surface.height);
    context.restore();
  }
}

async function drawVisualizerMedia(
  context: CanvasRenderingContext2D,
  layer: VisualizerLayer,
  timeMs: number,
  spinRotation: number,
  transform: VisualizerTransform,
  cache: MediaCache,
  assetResolver: RenderAssetResolver | null | undefined,
) {
  const source =
    layer.props.config.mediaSource ?? layer.props.config.logoSource;

  if (!source || !layer.props.config.logoVisible) {
    return;
  }

  const media = await resolveLoadedMedia(source, assetResolver, cache);

  if (!media) {
    return;
  }

  if (media.kind === "video") {
    syncVideoFrame(media.element, timeMs);
  }

  const logoRadius =
    SPECTERR_VISUALIZER_BASE_RADIUS *
    Math.max(0.2, layer.props.config.logoSizeFactor);

  withVisualizerTransform(context, transform, () => {
    if (
      layer.props.config.spinSettings.enabled &&
      !layer.props.config.spinSettings.logoLocked
    ) {
      context.rotate(spinRotation);
    }

    context.beginPath();
    context.arc(0, 0, Math.max(24, logoRadius), 0, Math.PI * 2);
    context.clip();
    drawMediaCover(context, media, logoRadius * 2, logoRadius * 2);
  });
}

export async function drawVisualizerLayer(
  context: CanvasRenderingContext2D,
  layer: VisualizerLayer,
  input: BrowserRenderAdapterRenderInput,
  cache: MediaCache,
  buffers: VisualizerBufferStore,
  assetResolver: RenderAssetResolver | null | undefined,
) {
  const config = layer.props.config;
  const ringCount = Math.max(1, config.waveCircles.length || 1);
  const surfaceMultiplier =
    input.surface.height / SPECTERR_VISUALIZER_BASE_HEIGHT;
  const effectiveRadiusFactor =
    config.radiusFactor > 0
      ? config.radiusFactor
      : SPECTERR_VISUALIZER_BASE_RADIUS;
  const circleScaleMultiplier =
    surfaceMultiplier *
    (effectiveRadiusFactor / SPECTERR_VISUALIZER_BASE_RADIUS);
  const visualizerScaleMultiplier =
    config.shape === "flat" ? surfaceMultiplier : circleScaleMultiplier;
  const drift = computeDriftTransform({
    drift: config.drift,
    kind: "visualizer",
    timeMs: input.frameContext.timeMs,
    spectrumMagnitude: layer.props.bassAmplitude,
    width:
      config.shape === "flat"
        ? Math.max(180, config.width > 0 ? config.width : 500) * surfaceMultiplier
        : SPECTERR_VISUALIZER_BASE_HEIGHT * circleScaleMultiplier,
    height:
      config.shape === "flat"
        ? SPECTERR_VISUALIZER_BASE_HEIGHT * surfaceMultiplier
        : SPECTERR_VISUALIZER_BASE_HEIGHT * circleScaleMultiplier,
  });
  const baseRotation = toRadians(config.rotation);
  const waveCircleOptions = createSpecterrWaveCircleOptions({
    barCount: config.barCount,
    customSettings: config.waveCircles.map(
      (waveCircle) => waveCircle.customOptions,
    ),
    delayed: config.delayed,
    layoutType: config.layoutType,
    reflectionType: config.reflectionType,
    ringCount,
    separation: config.seperationFactor,
    shape: config.shape,
    smoothed: config.smoothed,
    waveScale: config.waveScaleFactor,
    waveStyle: config.waveStyle,
    waveType: config.waveType,
  });
  let lastVisibleRenderConfig: VisualizerRingRenderConfig | null = null;
  let lastVisibleSpectrumMagnitude = 0;

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const ring = getVisualizerRingStyle(layer, ringIndex);

    if (!ring.visible) {
      continue;
    }

    const renderConfig = resolveVisualizerRingRenderConfig(config, ring);
    const waveCircleOption =
      waveCircleOptions[ringIndex] ?? waveCircleOptions[0]!;
    const processedSpectrum = getSpectrumForVisualizer(
      layer,
      input,
      waveCircleOption,
      renderConfig.waveType,
    );

    lastVisibleRenderConfig = renderConfig;
    lastVisibleSpectrumMagnitude = averageSpectrumMagnitude(processedSpectrum);
  }

  const dominantWaveType = lastVisibleRenderConfig?.waveType ?? config.waveType;
  const bounceScale = getVisualizerBounceScale(
    lastVisibleSpectrumMagnitude,
    dominantWaveType,
    config.bounceFactor,
  );
  const shakeStrength = getVisualizerShakeFactor(
    config.shakeAmount,
    dominantWaveType,
  );
  const shake =
    !drift && shakeStrength > 0
      ? (buffers.shakeOffset = advanceVisualizerShakeOffset(
          buffers.shakeOffset,
          lastVisibleSpectrumMagnitude,
          shakeStrength,
        ))
      : { x: 0, y: 0 };
  const globalSpinRotation = drift
    ? 0
    : getGlobalVisualizerSpinRotation(
        input.frameContext.timeMs,
        layer.props.bassAmplitude,
        config.spinSettings,
      );
  const transform: VisualizerTransform = {
    rotation: baseRotation + (drift?.rotationRad ?? 0),
    scale: visualizerScaleMultiplier * (drift?.scale ?? 1) * bounceScale,
    x:
      input.surface.width / 2 +
      config.position.x * surfaceMultiplier +
      (drift?.translateX ?? 0) +
      shake.x,
    y:
      input.surface.height / 2 +
      config.position.y * surfaceMultiplier +
      (drift?.translateY ?? 0) +
      shake.y,
  };

  buffers.main = ensureBuffer(buffers.main, input.surface);
  buffers.glow = ensureBuffer(buffers.glow, input.surface);
  buffers.composite = ensureBuffer(buffers.composite, input.surface);

  const mainContext = prepareBufferContext(buffers.main, input.surface);
  const glowContext = prepareBufferContext(buffers.glow, input.surface);
  const compositeContext = prepareBufferContext(buffers.composite, input.surface);
  const shouldDrawGlowLayer =
    config.glowSettings.enabled || config.fireSettings.enabled;

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const ring = getVisualizerRingStyle(layer, ringIndex);

    if (!ring.visible) {
      continue;
    }

    const renderConfig = resolveVisualizerRingRenderConfig(config, ring);
    const waveCircleOption =
      waveCircleOptions[ringIndex] ?? waveCircleOptions[0]!;
    const processedSpectrum = getSpectrumForVisualizer(
      layer,
      input,
      waveCircleOption,
      renderConfig.waveType,
    );
    const radius = SPECTERR_VISUALIZER_BASE_RADIUS * waveCircleOption.scale;
    const width = Math.max(180, config.width > 0 ? config.width : 500);
    const ringRotation = getRingRotation(
      input.frameContext.timeMs,
      ringIndex,
      0,
      layer.props.bassAmplitude,
      ring.spinSettings,
    );
    const activeReflectionAngles =
      config.shape === "flat"
        ? [0]
        : getReflectionAngles(renderConfig.reflectionType);
    const baseHeight = Math.max(
      80,
      (config.baseHeight > 0 ? config.baseHeight : 120) +
        waveCircleOption.heightAdjust,
    );

    for (const reflectionAngle of activeReflectionAngles) {
      const shapeInput: VisualizerShapeRenderInput = {
        baseHeight,
        config,
        context: mainContext,
        input,
        processedSpectrum,
        radius,
        renderConfig,
        ring,
        waveCircleOption,
        width,
      };
      const rotation =
        reflectionAngle +
        globalSpinRotation +
        renderConfig.rotationRad +
        (config.shape === "flat" ? 0 : ringRotation);

      drawShapeIntoLayer(mainContext, transform, rotation, shapeInput);

      if (shouldDrawGlowLayer) {
        drawShapeIntoLayer(
          glowContext,
          transform,
          rotation,
          { ...shapeInput, context: glowContext },
        );
      }
    }
  }

  applyVisualizerCenterCutout(mainContext, config, transform);
  applyVisualizerCenterCutout(glowContext, config, transform);

  const scaledGlowBlur = config.glowSettings.blur * surfaceMultiplier;
  const scaledShadowBlur = config.dropShadowSettings.blur * surfaceMultiplier;

  if (config.dropShadowSettings.enabled) {
    drawShadowPasses(
      compositeContext,
      config.glowSettings.enabled ? buffers.glow : buffers.main,
      input.surface,
      config.dropShadowSettings.color,
      scaledShadowBlur,
      config.dropShadowSettings.opacity,
    );
  }

  if (config.fireSettings.enabled) {
    drawFirePasses(
      compositeContext,
      buffers.main,
      input.surface,
      input.frameContext.timeMs,
      config.fireSettings.intensity,
      config.fireSettings.detail,
      surfaceMultiplier,
    );

    if (config.glowSettings.enabled) {
      drawFirePasses(
        compositeContext,
        buffers.glow,
        input.surface,
        input.frameContext.timeMs,
        config.fireSettings.intensity,
        config.fireSettings.detail,
        surfaceMultiplier,
      );
    }
  }

  if (config.glowSettings.enabled) {
    drawGlowPasses(
      compositeContext,
      buffers.glow,
      input.surface,
      scaledGlowBlur,
      config.glowSettings.scale,
      config.glowSettings.glowType,
    );
  }

  if (!(config.glowSettings.enabled && config.glowSettings.glowType === "inner")) {
    compositeContext.drawImage(
      buffers.main,
      0,
      0,
      input.surface.width,
      input.surface.height,
    );
  }

  context.drawImage(
    buffers.composite,
    0,
    0,
    input.surface.width,
    input.surface.height,
  );

  await drawVisualizerMedia(
    context,
    layer,
    input.frameContext.timeMs,
    globalSpinRotation,
    transform,
    cache,
    assetResolver,
  );
}
