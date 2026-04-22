import {
  BlurFilter,
  ColorMatrixFilter,
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

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
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

export class PixiBackdropLayer {
  readonly container = new Container();
  private readonly mediaContainer = new Container();
  private readonly vignette = new Graphics();
  private readonly colorFilter = new ColorMatrixFilter();
  private readonly blurFilter = new BlurFilter({ quality: 2, strength: 0 });
  private readonly mediaCache = createMediaCache();
  private readonly sprites = [new Sprite(), new Sprite(), new Sprite(), new Sprite()];
  private loadedTexture: LoadedTexture | null = null;

  constructor(
    private readonly assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.container.zIndex = 0;
    this.mediaContainer.filters = [this.colorFilter, this.blurFilter];
    this.container.addChild(this.mediaContainer);
    this.container.addChild(this.vignette);

    for (const sprite of this.sprites) {
      sprite.anchor.set(0.5);
      this.mediaContainer.addChild(sprite);
    }
  }

  private async ensureTexture(layer: BackdropLayer) {
    if (!layer.props.source) {
      return null;
    }

    const media = await resolveLoadedMedia(
      layer.props.source,
      this.assetResolver,
      this.mediaCache,
    );

    if (!media) {
      return null;
    }

    if (media.kind === "video") {
      syncVideoFrame(media.element, performance.now());
    }

    const key = layer.props.source.assetId ?? layer.props.source.url ?? "backdrop";

    if (this.loadedTexture?.key !== key) {
      this.loadedTexture = {
        key,
        texture: Texture.from(media.element, true),
      };
    }

    return {
      media,
      texture: this.loadedTexture.texture,
    };
  }

  async render(layer: BackdropLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.container.visible = Boolean(layer);

    if (!layer) {
      return;
    }

    const loaded = await this.ensureTexture(layer);

    if (!loaded) {
      this.mediaContainer.visible = false;
      return;
    }

    this.mediaContainer.visible = true;

    if (loaded.media.kind === "video") {
      syncVideoFrame(loaded.media.element, input.frameContext.timeMs);
      loaded.texture.source.update();
    }

    const drift = computeDriftTransform({
      drift: layer.props.drift,
      kind: "backdrop",
      timeMs: input.frameContext.timeMs,
      spectrumMagnitude: layer.props.bassAmplitude,
      width: input.surface.width,
      height: input.surface.height,
    });
    const normalizedBassAmplitude = normalizeAmplitude(layer.props.bassAmplitude);
    const bounceScale = layer.props.bounceEnabled
      ? 1 + normalizedBassAmplitude * Math.max(0, layer.props.bounceScale)
      : 1;
    const shake =
      !drift && layer.props.shakeEnabled
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
    const mediaScale =
      (drift?.scale ?? 1) *
      Math.max(1, layer.props.paddingFactor) *
      bounceScale;
    const cover = computeCoverDimensions(
      loaded.media.kind === "video"
        ? loaded.media.element.videoWidth
        : loaded.media.element.naturalWidth,
      loaded.media.kind === "video"
        ? loaded.media.element.videoHeight
        : loaded.media.element.naturalHeight,
      input.surface.width,
      input.surface.height,
    );
    const reflectionAngles =
      layer.props.reflection.type === "none"
        ? [0]
        : getReflectionAngles(layer.props.reflection.type);
    const mirror = getBackdropMirrorAxes(layer.props.reflection.direction);
    const contrast = layer.props.contrastEnabled
      ? Math.min(
          Math.max(1, layer.props.maxContrast),
          1 + normalizedBassAmplitude * Math.max(0, layer.props.contrastFactor),
        )
      : 1;
    const saturation =
      layer.props.filterEnabled || layer.props.hlsAdjustment.enabled
        ? layer.props.hlsAdjustment.saturation / 100
        : 0;
    const lightness =
      layer.props.filterEnabled || layer.props.hlsAdjustment.enabled
        ? 1 + layer.props.hlsAdjustment.lightness / 100
        : 1;
    const hue =
      layer.props.filterEnabled || layer.props.hlsAdjustment.enabled
        ? layer.props.hlsAdjustment.hue
        : 0;
    const blurStrength = layer.props.zoomBlurEnabled
      ? Math.min(
          Math.max(0, layer.props.maxZoomBlur),
          normalizedBassAmplitude * Math.max(0, layer.props.zoomBlurFactor),
        ) * 0.6
      : 0;

    this.colorFilter.reset();
    this.colorFilter.hue(hue, false);
    this.colorFilter.saturate(saturation, true);
    this.colorFilter.brightness(lightness, true);
    this.colorFilter.contrast(contrast, true);
    this.blurFilter.strength = blurStrength;
    this.mediaContainer.position.set(
      input.surface.width / 2 + (drift?.translateX ?? 0) + shake.x,
      input.surface.height / 2 + (drift?.translateY ?? 0) + shake.y,
    );
    this.mediaContainer.rotation =
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
      sprite.width = cover.width;
      sprite.height = cover.height;
      sprite.rotation = angle;
      sprite.alpha = index === 0 ? 1 : 0.4;
      sprite.scale.set(
        mediaScale * (index === 0 ? 1 : mirror.x),
        mediaScale * (index === 0 ? 1 : mirror.y),
      );
    }

    const vignetteStrength = layer.props.vignetteEnabled
      ? Math.min(
          Math.max(0, layer.props.maxVignette),
          normalizedBassAmplitude * Math.max(0, layer.props.vignetteFactor),
        )
      : 0;

    this.vignette.clear();

    if (vignetteStrength > 0) {
      this.vignette
        .rect(0, 0, input.surface.width, input.surface.height)
        .fill({ alpha: clamp(vignetteStrength * 0.4, 0, 0.9), color: 0x000000 });
    }
  }

  destroy() {
    this.container.destroy({ children: true });
    this.loadedTexture?.texture.destroy(true);
    this.loadedTexture = null;
  }
}

