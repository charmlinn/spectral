import {
  Container,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";
import {
  computeDriftTransform,
  type RenderAssetResolver,
  type RenderLayer,
} from "@spectral/render-core";

import { createMediaCache, resolveLoadedMedia, syncVideoFrame } from "../../adapters/canvas-media";
import {
  average,
  clamp,
  SPECTERR_VISUALIZER_BASE_HEIGHT,
  SPECTERR_VISUALIZER_BASE_RADIUS,
  toRadians,
} from "../../adapters/canvas-utils";
import {
  averageSpectrumMagnitude,
  advanceVisualizerShakeOffset,
  getSpectrumForVisualizer,
  getVisualizerBounceScale,
  getVisualizerRingStyle,
  getVisualizerShakeFactor,
  resolveVisualizerRingRenderConfig,
  getVisualizerTargetMax,
} from "../../adapters/visualizer/behavior";
import {
  buildCircleBarPointSets,
  buildCircleWavePoints,
} from "../../adapters/visualizer/geometry";
import { createSpecterrWaveCircleOptions } from "../../adapters/specterr-visualizer-options";
import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  createVisualizerBloomFilter,
  createVisualizerDisplacementFilter,
  createVisualizerDropShadowFilters,
  drawCircleGraphic,
  drawPolygonGraphic,
  updateDisplacementFilter,
  updateDropShadowFilters,
  updateGlowFilter,
  updateLogoSprite,
} from "./shared";

type VisualizerLayer = Extract<RenderLayer, { kind: "visualizer" }>;
type VisualizerRing = VisualizerLayer["props"]["config"]["waveCircles"][number];

export class WaveCircleRenderer {
  readonly container = new Container();
  private readonly logoContainer = new Container();
  private readonly visualsContainer = new Container();
  private readonly centerCutoutMask = new Graphics();
  private readonly waveContainer = new Container();
  private readonly glowContainer = new Container();
  private readonly logoSprite = new Sprite();
  private readonly mediaCache = createMediaCache();
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
  private currentLogoKey: string | null = null;
  private currentLogoTexture: Texture | null = null;
  private currentBaseRotation = 0;
  private globalSpinRotation = 0;
  private ringSpinRotations: number[] = [];
  private lastAnimationTimeMs: number | null = null;
  private shakeOffset = { x: 0, y: 0 };

  constructor(
    private readonly assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.container.sortableChildren = true;
    this.container.zIndex = 3;
    this.logoContainer.zIndex = 10.1;
    this.visualsContainer.zIndex = 10;
    this.visualsContainer.sortableChildren = true;
    this.logoContainer.addChild(this.logoSprite);
    this.visualsContainer.addChild(this.centerCutoutMask);
    this.visualsContainer.addChild(this.displacement.displacementSprite);
    this.visualsContainer.addChild(this.glowContainer);
    this.visualsContainer.addChild(this.waveContainer);
    this.glowContainer.mask = this.centerCutoutMask;
    this.waveContainer.mask = this.centerCutoutMask;
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
    this.container.addChild(this.logoContainer, this.visualsContainer);
  }

  private ensureRingCount(count: number) {
    while (this.waveGraphics.length < count) {
      const waveGraphic = new Graphics();
      const glowGraphic = new Graphics();

      this.waveContainer.addChild(waveGraphic);
      this.glowContainer.addChild(glowGraphic);
      this.waveGraphics.push(waveGraphic);
      this.glowGraphics.push(glowGraphic);
      this.ringSpinRotations.push(0);
    }

    while (this.waveGraphics.length > count) {
      const waveGraphic = this.waveGraphics.pop();
      const glowGraphic = this.glowGraphics.pop();

      waveGraphic?.destroy();
      glowGraphic?.destroy();
      this.ringSpinRotations.pop();
    }
  }

  private getAnimationDelta(timeMs: number) {
    const lastTimeMs = this.lastAnimationTimeMs;
    this.lastAnimationTimeMs = timeMs;

    if (lastTimeMs === null) {
      return 0;
    }

    const deltaMs = timeMs - lastTimeMs;

    if (deltaMs <= 0 || deltaMs > 250) {
      return 0;
    }

    return deltaMs;
  }

  resetSpinPosition(baseRotation = this.currentBaseRotation) {
    this.globalSpinRotation = 0;
    this.ringSpinRotations = this.ringSpinRotations.map(() => 0);
    this.lastAnimationTimeMs = null;
    this.logoContainer.rotation = baseRotation;
    this.visualsContainer.rotation = baseRotation;
  }

  private getSpinDelta(
    speed: number,
    acceleration: number,
    bassAmplitude: number,
    deltaMs: number,
  ) {
    let radiansRotation = ((speed * ((Math.PI * 2) / 60)) * deltaMs) / 1000;
    const radiansAcceleration =
      ((acceleration * ((Math.PI * 2) / 60)) * deltaMs) / 1000;

    radiansRotation += radiansAcceleration * (bassAmplitude / 2);

    return radiansRotation;
  }

  private updateCenterCutoutMask(centerCutoutFactor: number) {
    const cutout = clamp(centerCutoutFactor, 1, 99);

    this.centerCutoutMask.clear();
    this.centerCutoutMask.rect(-1000, -1000, 2000, 2000);
    this.centerCutoutMask.fill(0xffffff);
    this.centerCutoutMask.circle(0, 0, cutout);
    this.centerCutoutMask.cut();
  }

  private async updateLogoTexture(layer: VisualizerLayer, timeMs: number) {
    const source =
      layer.props.config.logoSource ?? layer.props.config.mediaSource;

    if (!source || !layer.props.config.logoVisible) {
      this.logoSprite.visible = false;
      return;
    }

    const media = await resolveLoadedMedia(
      source,
      this.assetResolver,
      this.mediaCache,
    );

    if (!media) {
      this.logoSprite.visible = false;
      return;
    }

    if (media.kind === "video") {
      syncVideoFrame(media.element, timeMs);
    }

    const key = source.assetId ?? source.url ?? "visualizer-logo";

    if (this.currentLogoKey !== key) {
      this.currentLogoKey = key;
      this.currentLogoTexture = Texture.from(media.element, true);
    } else if (media.kind === "video" && this.currentLogoTexture) {
      this.currentLogoTexture.source.update();
    }

    if (!this.currentLogoTexture) {
      this.logoSprite.visible = false;
      return;
    }

    const logoSize =
      SPECTERR_VISUALIZER_BASE_RADIUS *
      2 *
      Math.max(0.2, layer.props.config.logoSizeFactor);
    const logoPosition =
      -SPECTERR_VISUALIZER_BASE_RADIUS +
      SPECTERR_VISUALIZER_BASE_RADIUS *
        (1 - Math.max(0.2, layer.props.config.logoSizeFactor));

    updateLogoSprite(
      this.logoSprite,
      this.currentLogoTexture,
      logoSize,
      logoPosition,
    );
    this.logoSprite.visible = true;
  }

  private drawSolidRing(
    graphic: Graphics,
    ring: VisualizerRing,
    processedSpectrum: number[],
    reflectionType: string,
    inverted: boolean,
    targetMax: number,
    waveScale: number,
  ) {
    const { magnitudePercents, points } = buildCircleWavePoints(
      processedSpectrum,
      SPECTERR_VISUALIZER_BASE_RADIUS,
      reflectionType,
      inverted,
      targetMax,
      waveScale,
    );
    const mixPercent = clamp(average(magnitudePercents) * 5, 0, 1);

    graphic.clear();
    drawPolygonGraphic(graphic, points, ring, mixPercent, true);
  }

  private drawBarRing(
    graphic: Graphics,
    ring: VisualizerRing,
    processedSpectrum: number[],
    reflectionType: string,
    inverted: boolean,
    targetMax: number,
    waveScale: number,
    barWidth: number,
  ) {
    const { magnitudePercents, pointSets } = buildCircleBarPointSets(
      processedSpectrum,
      SPECTERR_VISUALIZER_BASE_RADIUS,
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

      drawPolygonGraphic(graphic, pointSet, ring, magnitudePercents[index] ?? 0, true);
    }
  }

  private drawPointRing(
    graphic: Graphics,
    ring: VisualizerRing,
    processedSpectrum: number[],
    reflectionType: string,
    inverted: boolean,
    targetMax: number,
    waveScale: number,
    pointRadius: number,
  ) {
    const { magnitudePercents, points } = buildCircleWavePoints(
      processedSpectrum,
      SPECTERR_VISUALIZER_BASE_RADIUS,
      reflectionType,
      inverted,
      targetMax,
      waveScale,
    );

    graphic.clear();

    for (let index = 0; index < points.length - 1; index += 2) {
      drawCircleGraphic(
        graphic,
        points[index]!,
        points[index + 1]!,
        Math.max(1, pointRadius * 1.5),
        ring,
        magnitudePercents[Math.floor(index / 2)] ?? 0,
      );
    }
  }

  async render(layer: VisualizerLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.container.visible = Boolean(layer);

    if (!layer) {
      return;
    }

    const { config } = layer.props;
    const ringCount = Math.max(1, config.waveCircles.length || 1);
    const multiplier = input.surface.height / SPECTERR_VISUALIZER_BASE_HEIGHT;
    const effectiveRadiusFactor =
      config.radiusFactor > 0
        ? config.radiusFactor
        : SPECTERR_VISUALIZER_BASE_RADIUS;
    const scaleAmount =
      multiplier * (effectiveRadiusFactor / SPECTERR_VISUALIZER_BASE_RADIUS);
    const baseRotation = toRadians(config.rotation);
    this.currentBaseRotation = baseRotation;
    const waveCircleOptions = createSpecterrWaveCircleOptions({
      barCount: config.barCount,
      customSettings: config.waveCircles.map((waveCircle) => waveCircle.customOptions),
      delayed: config.delayed,
      layoutType: config.layoutType,
      reflectionType: config.reflectionType,
      ringCount,
      separation: config.seperationFactor,
      shape: "circle",
      smoothed: config.smoothed,
      waveScale: config.waveScaleFactor,
      waveStyle: config.waveStyle,
      waveType: config.waveType,
    });

    this.ensureRingCount(ringCount);
    this.logoContainer.visible = config.logoVisible;
    this.updateCenterCutoutMask(config.centerCutoutFactor);
    await this.updateLogoTexture(layer, input.frameContext.timeMs);

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

    const finalRingIndex = Math.max(0, ringCount - 1);
    const finalRing = getVisualizerRingStyle(layer, finalRingIndex);
    const finalRingRenderConfig = resolveVisualizerRingRenderConfig(
      config,
      finalRing,
    );
    const finalRingOptions =
      waveCircleOptions[finalRingIndex] ?? waveCircleOptions[0]!;
    const finalRingSpectrum = getSpectrumForVisualizer(
      layer,
      input,
      finalRingOptions,
      finalRingRenderConfig.waveType,
    );
    const finalRingSpectrumMagnitude = averageSpectrumMagnitude(
      finalRingSpectrum,
    );

    const dominantWaveType = finalRingRenderConfig.waveType ?? config.waveType;
    const bounceScale = getVisualizerBounceScale(
      finalRingSpectrumMagnitude,
      dominantWaveType,
      config.bounceFactor,
    );
    const drift = computeDriftTransform({
      drift: config.drift,
      kind: "visualizer",
      timeMs: input.frameContext.timeMs,
      spectrumMagnitude: layer.props.bassAmplitude,
      width: SPECTERR_VISUALIZER_BASE_HEIGHT * scaleAmount,
      height: SPECTERR_VISUALIZER_BASE_HEIGHT * scaleAmount,
    });
    const shakeStrength = getVisualizerShakeFactor(
      config.shakeAmount,
      dominantWaveType,
    );
    const shake =
      !drift && shakeStrength > 0
        ? (this.shakeOffset = advanceVisualizerShakeOffset(
            this.shakeOffset,
            finalRingSpectrumMagnitude,
            shakeStrength,
          ))
        : { x: 0, y: 0 };
    const animationDeltaMs = this.getAnimationDelta(
      input.animationTimeMs ?? performance.now(),
    );

    if (
      input.playing &&
      !drift &&
      config.spinSettings.enabled &&
      animationDeltaMs > 0
    ) {
      this.globalSpinRotation += this.getSpinDelta(
        config.spinSettings.speed,
        config.spinSettings.acceleration,
        layer.props.bassAmplitude,
        animationDeltaMs,
      );
    }
    const visibleGlobalSpinRotation = drift ? 0 : this.globalSpinRotation;

    const positionX =
      input.surface.width / 2 +
      config.position.x * multiplier +
      (drift?.translateX ?? 0) +
      shake.x;
    const positionY =
      input.surface.height / 2 +
      config.position.y * multiplier +
      (drift?.translateY ?? 0) +
      shake.y;
    const finalScale = scaleAmount * bounceScale * (drift?.scale ?? 1);
    const finalRotation = baseRotation + (drift?.rotationRad ?? 0);

    this.visualsContainer.x = positionX;
    this.visualsContainer.y = positionY;
    this.visualsContainer.scale.set(finalScale, finalScale);
    this.visualsContainer.rotation = finalRotation + visibleGlobalSpinRotation;

    this.logoContainer.x = positionX;
    this.logoContainer.y = positionY;
    this.logoContainer.scale.set(finalScale, finalScale);
    this.logoContainer.rotation =
      finalRotation +
      (config.spinSettings.logoLocked ? 0 : visibleGlobalSpinRotation);

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
      if (input.playing && ring.spinSettings.enabled && animationDeltaMs > 0) {
        this.ringSpinRotations[ringIndex] =
          (this.ringSpinRotations[ringIndex] ?? 0) +
          this.getSpinDelta(
            ring.spinSettings.speed,
            ring.spinSettings.acceleration,
            layer.props.bassAmplitude,
            animationDeltaMs,
          );
      }

      const graphicRotation =
        renderConfig.rotationRad +
        (ring.spinSettings.enabled ? (this.ringSpinRotations[ringIndex] ?? 0) : 0);

      waveGraphic.scale.set(waveCircleOption.scale, waveCircleOption.scale);
      glowGraphic.scale.set(waveCircleOption.scale, waveCircleOption.scale);
      waveGraphic.rotation = graphicRotation;
      glowGraphic.rotation = graphicRotation;

      if (renderConfig.waveStyle === "bar") {
        this.drawBarRing(
          waveGraphic,
          ring,
          processedSpectrum,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.barWidth,
        );
        this.drawBarRing(
          glowGraphic,
          ring,
          processedSpectrum,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.barWidth,
        );
        continue;
      }

      if (renderConfig.waveStyle === "point") {
        this.drawPointRing(
          waveGraphic,
          ring,
          processedSpectrum,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.pointRadius,
        );
        this.drawPointRing(
          glowGraphic,
          ring,
          processedSpectrum,
          renderConfig.reflectionType,
          renderConfig.inverted,
          targetMax,
          waveCircleOption.waveScale,
          renderConfig.pointRadius,
        );
        continue;
      }

      this.drawSolidRing(
        waveGraphic,
        ring,
        processedSpectrum,
        renderConfig.reflectionType,
        renderConfig.inverted,
        targetMax,
        waveCircleOption.waveScale,
      );
      this.drawSolidRing(
        glowGraphic,
        ring,
        processedSpectrum,
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
