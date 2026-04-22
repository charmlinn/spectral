import { Container, Graphics } from "pixi.js";
import {
  computeDriftTransform,
  type RenderLayer,
} from "@spectral/render-core";

import {
  SPECTERR_VISUALIZER_BASE_HEIGHT,
  average,
  clamp,
  toRadians,
} from "../../adapters/canvas-utils";
import {
  averageSpectrumMagnitude,
  advanceVisualizerShakeOffset,
  getSpectrumForVisualizer,
  getVisualizerRingStyle,
  getVisualizerShakeFactor,
  getVisualizerTargetMax,
  resolveVisualizerRingRenderConfig,
} from "../../adapters/visualizer/behavior";
import {
  buildFlatWaveBars,
  buildFlatWavePoints,
} from "../../adapters/visualizer/geometry";
import { createSpecterrWaveCircleOptions } from "../../adapters/specterr-visualizer-options";
import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  createVisualizerBloomFilter,
  createVisualizerDisplacementFilter,
  createVisualizerDropShadowFilters,
  drawCircleGraphic,
  drawPolygonGraphic,
  drawRectGraphic,
  updateDisplacementFilter,
  updateDropShadowFilters,
  updateGlowFilter,
} from "./shared";

type VisualizerLayer = Extract<RenderLayer, { kind: "visualizer" }>;
type VisualizerRing = VisualizerLayer["props"]["config"]["waveCircles"][number];

export class FlatWaveRenderer {
  readonly container = new Container();
  private readonly waveContainer = new Container();
  private readonly glowContainer = new Container();
  private readonly bloomFilter = createVisualizerBloomFilter(
    480 / SPECTERR_VISUALIZER_BASE_HEIGHT,
  );
  private readonly displacement = createVisualizerDisplacementFilter(
    480 / SPECTERR_VISUALIZER_BASE_HEIGHT,
  );
  private readonly dropShadowFilters = createVisualizerDropShadowFilters(
    480 / SPECTERR_VISUALIZER_BASE_HEIGHT,
  );
  private waveGraphics: Graphics[] = [];
  private glowGraphics: Graphics[] = [];
  private shakeOffset = { x: 0, y: 0 };

  constructor() {
    this.container.zIndex = 3;
    this.container.addChild(this.displacement.displacementSprite);
    this.container.addChild(this.glowContainer);
    this.container.addChild(this.waveContainer);
    this.glowContainer.filters = [
      this.bloomFilter,
      this.displacement.displacementFilter,
      this.dropShadowFilters.glowShadowFilter1,
      this.dropShadowFilters.glowShadowFilter2,
    ];
    this.waveContainer.filters = [
      this.displacement.displacementFilter,
      this.dropShadowFilters.waveShadowFilter1,
      this.dropShadowFilters.waveShadowFilter2,
      this.dropShadowFilters.waveShadowPaddingFilter,
    ];
  }

  private ensureRingCount(count: number) {
    while (this.waveGraphics.length < count) {
      const waveGraphic = new Graphics();
      const glowGraphic = new Graphics();

      this.waveContainer.addChild(waveGraphic);
      this.glowContainer.addChild(glowGraphic);
      this.waveGraphics.push(waveGraphic);
      this.glowGraphics.push(glowGraphic);
    }

    while (this.waveGraphics.length > count) {
      this.waveGraphics.pop()?.destroy();
      this.glowGraphics.pop()?.destroy();
    }
  }

  private drawSolidWave(
    graphic: Graphics,
    ring: VisualizerRing,
    processedSpectrum: number[],
    width: number,
    baseHeight: number,
    reflectionType: string,
    inverted: boolean,
    targetMax: number,
    waveScale: number,
  ) {
    const { magnitudePercents, points } = buildFlatWavePoints(
      processedSpectrum,
      width,
      baseHeight,
      reflectionType,
      inverted,
      targetMax,
      waveScale,
      "solid",
    );
    const mixPercent = clamp(average(magnitudePercents) * 5, 0, 1);

    graphic.clear();
    drawPolygonGraphic(graphic, points, ring, mixPercent, true);
  }

  private drawPointWave(
    graphic: Graphics,
    ring: VisualizerRing,
    processedSpectrum: number[],
    width: number,
    baseHeight: number,
    reflectionType: string,
    inverted: boolean,
    targetMax: number,
    waveScale: number,
    pointRadius: number,
  ) {
    const { magnitudePercents, points } = buildFlatWavePoints(
      processedSpectrum,
      width,
      baseHeight,
      reflectionType,
      inverted,
      targetMax,
      waveScale,
      "point",
    );

    graphic.clear();

    for (let index = 0; index < points.length - 1; index += 2) {
      drawCircleGraphic(
        graphic,
        points[index]!,
        points[index + 1]!,
        Math.max(1, pointRadius),
        ring,
        magnitudePercents[Math.floor(index / 2)] ?? 0,
      );
    }
  }

  private drawBarWave(
    graphic: Graphics,
    ring: VisualizerRing,
    processedSpectrum: number[],
    width: number,
    baseHeight: number,
    reflectionType: string,
    inverted: boolean,
    targetMax: number,
    waveScale: number,
    barWidth: number,
  ) {
    const { magnitudePercents, pointSets } = buildFlatWaveBars(
      processedSpectrum,
      width,
      baseHeight,
      reflectionType,
      inverted,
      targetMax,
      waveScale,
      barWidth,
    );

    graphic.clear();

    for (let index = 0; index < pointSets.length; index += 1) {
      const pointSet = pointSets[index];

      if (!pointSet) {
        continue;
      }

      drawRectGraphic(
        graphic,
        pointSet[0]!,
        pointSet[1]!,
        pointSet[2]!,
        pointSet[3]!,
        ring,
        magnitudePercents[index] ?? 0,
      );
    }
  }

  render(layer: VisualizerLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.container.visible = Boolean(layer);

    if (!layer) {
      return;
    }

    const { config } = layer.props;
    const ringCount = Math.max(1, config.waveCircles.length || 1);
    const multiplier = input.surface.height / SPECTERR_VISUALIZER_BASE_HEIGHT;
    const baseScaleMultiplier = multiplier;
    const baseRotation = toRadians(config.rotation);
    const waveCircleOptions = createSpecterrWaveCircleOptions({
      barCount: config.barCount,
      customSettings: config.waveCircles.map((waveCircle) => waveCircle.customOptions),
      delayed: config.delayed,
      layoutType: config.layoutType,
      reflectionType: config.reflectionType,
      ringCount,
      separation: config.seperationFactor,
      shape: "flat",
      smoothed: config.smoothed,
      waveScale: config.waveScaleFactor,
      waveStyle: config.waveStyle,
      waveType: config.waveType,
    });
    const drift = computeDriftTransform({
      drift: config.drift,
      kind: "visualizer",
      timeMs: input.frameContext.timeMs,
      spectrumMagnitude: layer.props.bassAmplitude,
      width: Math.max(180, config.width > 0 ? config.width : 500) * baseScaleMultiplier,
      height: SPECTERR_VISUALIZER_BASE_HEIGHT * baseScaleMultiplier,
    });

    this.ensureRingCount(ringCount);

    updateGlowFilter(this.bloomFilter, this.waveContainer, {
      blur: config.glowSettings.blur,
      enabled: config.glowSettings.enabled,
      glowType: config.glowSettings.glowType,
      multiplier,
      scale: config.glowSettings.scale,
    });
    updateDisplacementFilter(
      this.displacement.displacementFilter,
      this.displacement.displacementSprite,
      {
        detail: config.fireSettings.detail,
        enabled: config.fireSettings.enabled,
        intensity: config.fireSettings.intensity,
        multiplier,
      },
    );
    updateDropShadowFilters(this.dropShadowFilters, {
      blur: config.dropShadowSettings.blur,
      color: config.dropShadowSettings.color,
      enabled: config.dropShadowSettings.enabled,
      glowEnabled: config.glowSettings.enabled,
      multiplier,
      opacity: config.dropShadowSettings.opacity,
    });

    let lastVisibleWaveType = config.waveType;
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

      lastVisibleWaveType = renderConfig.waveType;
      lastVisibleSpectrumMagnitude = averageSpectrumMagnitude(processedSpectrum);
    }

    const shakeStrength = getVisualizerShakeFactor(
      config.shakeAmount,
      lastVisibleWaveType,
    );
    const shake =
      !drift && shakeStrength > 0
        ? (this.shakeOffset = advanceVisualizerShakeOffset(
            this.shakeOffset,
            lastVisibleSpectrumMagnitude,
            shakeStrength,
          ))
        : { x: 0, y: 0 };

    this.container.x =
      input.surface.width / 2 +
      config.position.x * multiplier +
      (drift?.translateX ?? 0) +
      shake.x;
    this.container.y =
      input.surface.height / 2 +
      config.position.y * multiplier +
      (drift?.translateY ?? 0) +
      shake.y;
    this.container.scale.set(
      baseScaleMultiplier * (drift?.scale ?? 1),
      baseScaleMultiplier * (drift?.scale ?? 1),
    );
    this.container.rotation = baseRotation + (drift?.rotationRad ?? 0);

    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const ring = getVisualizerRingStyle(layer, ringIndex);
      const waveGraphic = this.waveGraphics[ringIndex]!;
      const glowGraphic = this.glowGraphics[ringIndex]!;

      waveGraphic.visible = ring.visible;
      glowGraphic.visible = ring.visible && config.glowSettings.enabled;

      if (!ring.visible) {
        waveGraphic.clear();
        glowGraphic.clear();
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
      const targetMax = getVisualizerTargetMax(renderConfig.waveType);
      const baseHeight = Math.max(
        80,
        (config.baseHeight > 0 ? config.baseHeight : 120) +
          waveCircleOption.heightAdjust,
      );
      const width = Math.max(180, config.width > 0 ? config.width : 500);

      waveGraphic.scale.set(waveCircleOption.scale, waveCircleOption.scale);
      glowGraphic.scale.set(waveCircleOption.scale, waveCircleOption.scale);
      waveGraphic.rotation = renderConfig.rotationRad;
      glowGraphic.rotation = renderConfig.rotationRad;

      if (renderConfig.waveStyle === "bar") {
        this.drawBarWave(
          waveGraphic,
          ring,
          processedSpectrum,
          width,
          baseHeight,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.barWidth,
        );
        this.drawBarWave(
          glowGraphic,
          ring,
          processedSpectrum,
          width,
          baseHeight,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.barWidth,
        );
        continue;
      }

      if (renderConfig.waveStyle === "point") {
        this.drawPointWave(
          waveGraphic,
          ring,
          processedSpectrum,
          width,
          baseHeight,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.pointRadius,
        );
        this.drawPointWave(
          glowGraphic,
          ring,
          processedSpectrum,
          width,
          baseHeight,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.pointRadius,
        );
        continue;
      }

      this.drawSolidWave(
        waveGraphic,
        ring,
        processedSpectrum,
        width,
        baseHeight,
        renderConfig.reflectionType,
        renderConfig.inverted,
        targetMax,
        waveCircleOption.waveScale,
      );
      this.drawSolidWave(
        glowGraphic,
        ring,
        processedSpectrum,
        width,
        baseHeight,
        renderConfig.reflectionType,
        renderConfig.inverted,
        targetMax,
        waveCircleOption.waveScale,
      );
    }

    this.displacement.displacementSprite.y -= 4;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
