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
  getBackdropMirrorAxes,
  getReflectionAngles,
  normalizeAmplitude,
  toRadians,
} from "../../adapters/canvas-utils";
import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { createHslAdjustmentFilter, updateHslAdjustmentFilter } from "../filters/hsl-adjustment-filter";
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
  protected readonly spriteContainer = new Container();
  protected readonly sprites = [new Sprite(), new Sprite(), new Sprite(), new Sprite()];
  protected readonly mediaCache: MediaCache = createMediaCache();
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
    this.container.zIndex = 0;
    this.spriteContainer.filters = [
      this.hslFilter,
      this.crtFilter,
      this.adjustmentFilter,
      this.zoomBlurFilter,
    ];
    this.container.addChild(this.spriteContainer);

    for (const sprite of this.sprites) {
      sprite.anchor.set(0.5);
      this.spriteContainer.addChild(sprite);
    }
  }

  protected abstract accepts(media: LoadedMedia): boolean;

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
      this.spriteContainer.visible = false;
      return;
    }

    this.spriteContainer.visible = true;
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
    const reflectionAngles =
      layer.props.reflection.type === "none"
        ? [0]
        : getReflectionAngles(layer.props.reflection.type);
    const mirrorAxes = getBackdropMirrorAxes(layer.props.reflection.direction);
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
    this.adjustmentFilter.contrast = contrast;
    this.crtFilter.vignetting = vignette;
    this.zoomBlurFilter.center = {
      x: input.surface.width / 2 + (drift?.translateX ?? 0) + shake.x,
      y: input.surface.height / 2 + (drift?.translateY ?? 0) + shake.y,
    };
    this.zoomBlurFilter.strength = zoomBlurStrength;
    this.zoomBlurFilter.innerRadius = 0;
    this.zoomBlurFilter.radius = input.surface.height / 2;
    this.spriteContainer.position.set(
      input.surface.width / 2 + (drift?.translateX ?? 0) + shake.x,
      input.surface.height / 2 + (drift?.translateY ?? 0) + shake.y,
    );
    this.spriteContainer.rotation =
      toRadians(layer.props.rotation) + (drift?.rotationRad ?? 0);

    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!;
      const angle = reflectionAngles[index];

      if (angle === undefined) {
        sprite.visible = false;
        continue;
      }

      sprite.visible = true;
      sprite.texture = loaded.texture;
      sprite.width = baseWidth;
      sprite.height = baseHeight;
      sprite.rotation = angle;
      sprite.alpha = index === 0 ? 1 : 0.4;

      if (index === 0) {
        sprite.scale.set(1, 1);
      } else {
        sprite.scale.set(mirrorAxes.x, mirrorAxes.y);
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
    this.loadedTexture?.texture.destroy(true);
    this.loadedTexture = null;
    this.activeMedia = null;
  }
}
