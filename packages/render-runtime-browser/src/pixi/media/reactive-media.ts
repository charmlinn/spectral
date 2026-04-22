import { Container, Sprite, Texture } from "pixi.js";
import { AdjustmentFilter, CRTFilter, ZoomBlurFilter } from "pixi-filters";
import {
  computeDriftTransform,
  type RenderAssetResolver,
  type RenderLayer,
} from "@spectral/render-core";
import type { LoadedMedia, MediaCache } from "../../adapters/canvas-media";
import {
  createMediaCache,
  resolveLoadedMedia,
  syncVideoFrame,
} from "../../adapters/canvas-media";
import {
  clamp,
  normalizeAmplitude,
  toRadians,
} from "../../adapters/canvas-utils";
import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { createHslAdjustmentFilter, updateHslAdjustmentFilter } from "../filters/hsl-adjustment-filter";
import {
  createDirectionalMirrorFilter,
  updateDirectionalMirrorFilter,
} from "../filters/reflection/directional-mirror-filter";
import {
  createQuadrantMirrorFilter,
  updateQuadrantMirrorFilter,
} from "../filters/reflection/quadrant-mirror-filter";
import { mediaSourceDimensions } from "./media-source-dimension-tracker";

type BackdropLayer = Extract<RenderLayer, { kind: "backdrop" }>;

type LoadedTexture = {
  key: string;
  texture: Texture;
};

function computeCoverDimensions(
  mediaWidth: number,
  mediaHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (mediaWidth <= 0 || mediaHeight <= 0) {
    return {
      height: targetHeight,
      width: targetWidth,
    };
  }

  const scale = Math.max(targetWidth / mediaWidth, targetHeight / mediaHeight);

  return {
    height: mediaHeight * scale,
    width: mediaWidth * scale,
  };
}

export abstract class ReactiveMedia {
  readonly container = new Container();
  protected readonly sprite = new Sprite();
  protected readonly mediaCache: MediaCache = createMediaCache();
  protected readonly directionalMirrorFilter = createDirectionalMirrorFilter();
  protected readonly quadrantMirrorFilter = createQuadrantMirrorFilter();
  protected readonly hslFilter = createHslAdjustmentFilter();
  protected readonly crtFilter = new CRTFilter({
    curvature: 0,
    lineContrast: 0,
    lineWidth: 0,
    noise: 0,
    noiseSize: 1,
    vignetting: 0,
    vignettingAlpha: 1,
    vignettingBlur: 0.3,
  });
  protected readonly adjustmentFilter = new AdjustmentFilter({
    alpha: 1,
    blue: 1,
    brightness: 1,
    contrast: 1,
    gamma: 1,
    green: 1,
    red: 1,
    saturation: 1,
  });
  protected readonly zoomBlurFilter = new ZoomBlurFilter({
    center: { x: 0, y: 0 },
    innerRadius: 0,
    maxKernelSize: 32,
    radius: -1,
    strength: 0,
  });
  protected loadedTexture: LoadedTexture | null = null;
  protected activeMedia: LoadedMedia | null = null;

  constructor(
    protected readonly assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.container.zIndex = 1;
    this.sprite.anchor.set(0.5);
    this.directionalMirrorFilter.enabled = false;
    this.quadrantMirrorFilter.enabled = false;
    this.sprite.filters = [
      this.directionalMirrorFilter,
      this.quadrantMirrorFilter,
      this.hslFilter,
      this.crtFilter,
      this.adjustmentFilter,
      this.zoomBlurFilter,
    ];
    this.container.addChild(this.sprite);
  }

  protected abstract accepts(media: LoadedMedia): boolean;

  private normalizeReflectionType(value: unknown) {
    if (typeof value === "number") {
      if (value === 2) {
        return "four-way";
      }

      if (value === 1) {
        return "two-way";
      }

      return "none";
    }

    const normalized = String(value ?? "none").trim().toLowerCase();

    if (normalized.includes("4") || normalized.includes("four")) {
      return "four-way";
    }

    if (normalized.includes("2") || normalized.includes("two")) {
      return "two-way";
    }

    return "none";
  }

  private normalizeReflectionDirection(value: unknown) {
    if (typeof value === "number" && value >= 0 && value <= 3) {
      return value;
    }

    const normalized = String(value ?? "down").trim().toLowerCase();

    if (normalized.includes("left")) {
      return 3;
    }

    if (normalized.includes("right")) {
      return 1;
    }

    if (normalized.includes("up") || normalized.includes("bottom")) {
      return 2;
    }

    return 0;
  }

  private updateReflectionFilters(
    layer: BackdropLayer,
    width: number,
    height: number,
  ) {
    const reflectionType = this.normalizeReflectionType(layer.props.reflection.type);
    const reflectionDirection = this.normalizeReflectionDirection(
      layer.props.reflection.direction,
    );

    if (reflectionType === "two-way") {
      updateDirectionalMirrorFilter(this.directionalMirrorFilter, {
        boundary: 0.5,
        direction: reflectionDirection,
        enabled: true,
        height,
        width,
      });
      updateQuadrantMirrorFilter(this.quadrantMirrorFilter, {
        direction: reflectionDirection,
        enabled: false,
        height,
        width,
      });
      return;
    }

    if (reflectionType === "four-way") {
      updateQuadrantMirrorFilter(this.quadrantMirrorFilter, {
        direction: reflectionDirection,
        enabled: true,
        height,
        width,
      });
      updateDirectionalMirrorFilter(this.directionalMirrorFilter, {
        boundary: 0.5,
        direction: reflectionDirection,
        enabled: false,
        height,
        width,
      });
      return;
    }

    updateDirectionalMirrorFilter(this.directionalMirrorFilter, {
      boundary: 0.5,
      direction: reflectionDirection,
      enabled: false,
      height,
      width,
    });
    updateQuadrantMirrorFilter(this.quadrantMirrorFilter, {
      direction: reflectionDirection,
      enabled: false,
      height,
      width,
    });
  }

  protected async ensureTexture(layer: BackdropLayer) {
    if (!layer.props.source) {
      this.activeMedia = null;
      return null;
    }

    const media = await resolveLoadedMedia(
      layer.props.source,
      this.assetResolver,
      this.mediaCache,
    );

    if (!media || !this.accepts(media)) {
      this.activeMedia = null;
      return null;
    }

    const key = layer.props.source.assetId ?? layer.props.source.url ?? "backdrop";

    if (this.loadedTexture?.key !== key) {
      this.loadedTexture = {
        key,
        texture: Texture.from(media.element, true),
      };
    }

    this.activeMedia = media;

    return {
      media,
      texture: this.loadedTexture.texture,
    };
  }

  protected syncDynamicTexture(timeMs: number) {
    if (this.activeMedia?.kind === "video" && this.loadedTexture) {
      syncVideoFrame(this.activeMedia.element, timeMs);
      this.loadedTexture.texture.source.update();
    }
  }

  async render(layer: BackdropLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.container.visible = Boolean(layer);

    if (!layer) {
      return;
    }

    const loaded = await this.ensureTexture(layer);

    if (!loaded) {
      this.sprite.visible = false;
      return;
    }

    this.sprite.visible = true;
    this.syncDynamicTexture(input.frameContext.timeMs);

    const mediaWidth =
      loaded.media.kind === "video"
        ? loaded.media.element.videoWidth
        : loaded.media.element.naturalWidth;
    const mediaHeight =
      loaded.media.kind === "video"
        ? loaded.media.element.videoHeight
        : loaded.media.element.naturalHeight;
    const sourceUrl = layer.props.source?.url ?? null;
    const cachedDimensions =
      sourceUrl && mediaSourceDimensions[sourceUrl]
        ? mediaSourceDimensions[sourceUrl]
        : null;
    const resolvedMediaWidth = mediaWidth || cachedDimensions?.width || input.surface.width;
    const resolvedMediaHeight =
      mediaHeight || cachedDimensions?.height || input.surface.height;

    if (sourceUrl && resolvedMediaWidth > 0 && resolvedMediaHeight > 0) {
      mediaSourceDimensions[sourceUrl] = {
        height: resolvedMediaHeight,
        width: resolvedMediaWidth,
      };
    }
    const normalizedBassAmplitude = normalizeAmplitude(layer.props.bassAmplitude);
    const drift = computeDriftTransform({
      drift: layer.props.drift,
      kind: "backdrop",
      timeMs: input.frameContext.timeMs,
      spectrumMagnitude: layer.props.bassAmplitude,
      width: input.surface.width,
      height: input.surface.height,
    });
    const bounceScale = layer.props.bounceEnabled
      ? 1 + normalizedBassAmplitude * Math.max(0, layer.props.bounceScale)
      : 1;
    const mediaScale =
      (drift?.scale ?? 1) *
      Math.max(1, layer.props.paddingFactor) *
      bounceScale;
    const cover = computeCoverDimensions(
      resolvedMediaWidth,
      resolvedMediaHeight,
      input.surface.width,
      input.surface.height,
    );
    const shakeEnabled = !drift && layer.props.shakeEnabled;
    const baseWidth = cover.width * mediaScale;
    const baseHeight = cover.height * mediaScale;
    const shake = shakeEnabled
      ? {
          x:
            Math.sin(input.frameContext.timeMs / 80) *
            Math.max(0, layer.props.shakeFactor) *
            normalizedBassAmplitude,
          y:
            Math.cos(input.frameContext.timeMs / 65) *
            Math.max(0, layer.props.shakeFactor) *
            normalizedBassAmplitude,
        }
      : { x: 0, y: 0 };
    const contrast = layer.props.contrastEnabled
      ? Math.min(
          Math.max(1, layer.props.maxContrast),
          1 + normalizedBassAmplitude * Math.max(0, layer.props.contrastFactor),
        )
      : 1;
    const zoomBlurStrength = layer.props.zoomBlurEnabled
      ? Math.min(
          Math.max(0, layer.props.maxZoomBlur),
          normalizedBassAmplitude * Math.max(0, layer.props.zoomBlurFactor),
        )
      : 0;
    const vignette = layer.props.vignetteEnabled
      ? Math.min(
          Math.max(0, layer.props.maxVignette),
          normalizedBassAmplitude * Math.max(0, layer.props.vignetteFactor),
        )
      : 0;

    updateHslAdjustmentFilter(this.hslFilter, {
      alpha: clamp(layer.props.hlsAdjustment.alpha, 0, 1),
      colorize: layer.props.hlsAdjustment.colorize,
      hue: layer.props.hlsAdjustment.hue,
      lightness: layer.props.hlsAdjustment.lightness,
      saturation: layer.props.hlsAdjustment.saturation,
    });
    this.updateReflectionFilters(layer, input.surface.width, input.surface.height);
    this.adjustmentFilter.contrast = contrast;
    this.crtFilter.vignetting = vignette;
    this.zoomBlurFilter.center = {
      x: input.surface.width / 2 + (drift?.translateX ?? 0) + shake.x,
      y: input.surface.height / 2 + (drift?.translateY ?? 0) + shake.y,
    };
    this.zoomBlurFilter.strength = zoomBlurStrength;
    this.zoomBlurFilter.innerRadius = 0;
    this.zoomBlurFilter.radius = input.surface.height / 2;
    this.sprite.position.set(
      input.surface.width / 2 + (drift?.translateX ?? 0) + shake.x,
      input.surface.height / 2 + (drift?.translateY ?? 0) + shake.y,
    );
    this.sprite.rotation =
      toRadians(layer.props.rotation) + (drift?.rotationRad ?? 0);
    this.sprite.texture = loaded.texture;
    this.sprite.width = baseWidth;
    this.sprite.height = baseHeight;
    this.sprite.alpha = 1;
    this.sprite.scale.set(1, 1);
  }

  destroy() {
    this.container.destroy({ children: true });
    this.loadedTexture?.texture.destroy(true);
    this.loadedTexture = null;
    this.activeMedia = null;
  }
}
