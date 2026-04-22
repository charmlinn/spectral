import {
  AlphaFilter,
  DisplacementFilter,
  Sprite,
  WRAP_MODES,
  type Container,
  type Graphics,
  type Texture,
} from "pixi.js";
import chroma from "chroma-js";
import { AdvancedBloomFilter, DropShadowFilter } from "pixi-filters";
import type { VisualizerWaveCircle } from "@spectral/project-schema";

import { clamp } from "../../adapters/canvas-utils";

export const SPECTERR_FIRE_TEXTURE_URL =
  "https://specterr.b-cdn.net/fire-texture.jpg";

function normalizeMixColorInput(input: string | null | undefined) {
  const normalized = input?.trim().toLowerCase();

  if (
    normalized === "0x000000" ||
    normalized === "#000000" ||
    normalized === "#000"
  ) {
    return "0x010101";
  }

  return input;
}

function toRgbTuple(input: string | null | undefined) {
  if (!input) {
    return { red: 255, green: 255, blue: 255 };
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    if (normalized.length === 4) {
      return {
        red: Number.parseInt(normalized[1]! + normalized[1]!, 16),
        green: Number.parseInt(normalized[2]! + normalized[2]!, 16),
        blue: Number.parseInt(normalized[3]! + normalized[3]!, 16),
      };
    }

    if (normalized.length === 7) {
      return {
        red: Number.parseInt(normalized.slice(1, 3), 16),
        green: Number.parseInt(normalized.slice(3, 5), 16),
        blue: Number.parseInt(normalized.slice(5, 7), 16),
      };
    }
  }

  const hexValue = normalized.startsWith("0x")
    ? normalized.slice(2)
    : normalized;
  const parsed = Number.parseInt(hexValue, 16);

  if (Number.isFinite(parsed)) {
    return {
      red: (parsed >> 16) & 255,
      green: (parsed >> 8) & 255,
      blue: parsed & 255,
    };
  }

  return { red: 255, green: 255, blue: 255 };
}

export function toPixiColor(input: string | null | undefined) {
  const { red, green, blue } = toRgbTuple(input);
  return (red << 16) | (green << 8) | blue;
}

export function mixPixiColor(
  primary: string | null | undefined,
  secondary: string | null | undefined,
  mixPercent: number,
) {
  if (!secondary) {
    return toPixiColor(primary);
  }

  const mix = clamp(mixPercent, 0, 1);
  const mixedColor = chroma
    .mix(
      normalizeMixColorInput(primary)?.replace("0x", "#") ?? "#ffffff",
      normalizeMixColorInput(secondary)?.replace("0x", "#") ?? "#ffffff",
      mix,
      "lch",
    )
    .hex()
    .replace("#", "");

  return Number.parseInt(mixedColor, 16);
}

export function resolveRingStyle(
  ring: VisualizerWaveCircle,
  mixPercent: number,
) {
  const mix = clamp(mixPercent, 0, 1);

  return {
    fillAlpha: clamp(
      ring.fillAlpha * (1 - mix) + ring.secondaryFillAlpha * mix,
      0,
      1,
    ),
    fillColor: mixPixiColor(ring.fillColor, ring.secondaryFillColor, mix),
    lineAlpha: clamp(
      ring.lineAlpha * (1 - mix) + ring.secondaryLineAlpha * mix,
      0,
      1,
    ),
    lineColor: mixPixiColor(ring.lineColor, ring.secondaryLineColor, mix),
    lineWidth: ring.lineWidth,
  };
}

export function drawPolygonGraphic(
  graphic: Graphics,
  points: number[],
  ring: VisualizerWaveCircle,
  mixPercent: number,
  fill = true,
) {
  const style = resolveRingStyle(ring, mixPercent);

  graphic.poly(points, true);

  if (fill) {
    graphic.fill({ alpha: style.fillAlpha, color: style.fillColor });
  }

  graphic.stroke({
    alpha: style.lineAlpha,
    color: style.lineColor,
    width: style.lineWidth,
  });
}

export function drawCircleGraphic(
  graphic: Graphics,
  x: number,
  y: number,
  radius: number,
  ring: VisualizerWaveCircle,
  mixPercent: number,
) {
  const style = resolveRingStyle(ring, mixPercent);

  graphic.circle(x, y, radius);
  graphic.fill({ alpha: style.fillAlpha, color: style.fillColor });
  graphic.stroke({
    alpha: style.lineAlpha,
    color: style.lineColor,
    width: style.lineWidth,
  });
}

export function drawRectGraphic(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  ring: VisualizerWaveCircle,
  mixPercent: number,
) {
  const style = resolveRingStyle(ring, mixPercent);

  graphic.rect(x, y, width, height);
  graphic.fill({ alpha: style.fillAlpha, color: style.fillColor });
  graphic.stroke({
    alpha: style.lineAlpha,
    color: style.lineColor,
    width: style.lineWidth,
  });
}

export function createVisualizerBloomFilter(multiplier: number) {
  const bloomFilter = new AdvancedBloomFilter({
    quality: 10,
    threshold: 0.01,
  });

  bloomFilter.padding = 100 * multiplier;

  return bloomFilter;
}

export function createVisualizerDisplacementFilter(
  multiplier: number,
) {
  const displacementSprite = Sprite.from(SPECTERR_FIRE_TEXTURE_URL);
  displacementSprite.visible = false;
  displacementSprite.renderable = false;
  const textureSource = displacementSprite.texture.source as unknown as {
    style?: {
      addressMode?: string;
      addressModeU?: string;
      addressModeV?: string;
    };
    wrapMode?: string;
  };

  if (textureSource.style) {
    textureSource.style.addressMode = "mirror-repeat";
    textureSource.style.addressModeU = "mirror-repeat";
    textureSource.style.addressModeV = "mirror-repeat";
  } else if ("wrapMode" in textureSource) {
    textureSource.wrapMode = WRAP_MODES.MIRRORED_REPEAT as unknown as string;
  }

  displacementSprite.x -= 500;

  const displacementFilter = new DisplacementFilter({
    scale: { x: 0, y: 0 },
    sprite: displacementSprite,
  });

  displacementFilter.padding = 110 * multiplier;

  return { displacementFilter, displacementSprite };
}

export function createVisualizerDropShadowFilters(multiplier: number) {
  const shadowSettings = {
    blur: 0,
    color: 0x000000,
    distance: 0,
    quality: 10,
  } as const;

  const glowShadowFilter1 = new DropShadowFilter(shadowSettings);
  const glowShadowFilter2 = new DropShadowFilter(shadowSettings);
  const waveShadowFilter1 = new DropShadowFilter(shadowSettings);
  const waveShadowFilter2 = new DropShadowFilter(shadowSettings);
  const waveShadowPaddingFilter = new AlphaFilter({ alpha: 1 });

  waveShadowPaddingFilter.padding = 100 * multiplier;

  return {
    glowShadowFilter1,
    glowShadowFilter2,
    waveShadowFilter1,
    waveShadowFilter2,
    waveShadowPaddingFilter,
  };
}

export function updateGlowFilter(
  bloomFilter: AdvancedBloomFilter,
  waveContainer: Container,
  input: {
    blur: number;
    enabled: boolean;
    glowType: string;
    multiplier: number;
    scale: number;
  },
) {
  bloomFilter.padding = 100 * input.multiplier;
  bloomFilter.blur = input.blur * input.multiplier;
  bloomFilter.bloomScale = input.scale;
  waveContainer.alpha =
    input.enabled && input.glowType.toLowerCase() === "inner" ? 0 : 1;
}

export function updateDisplacementFilter(
  displacementFilter: DisplacementFilter,
  displacementSprite: Sprite,
  input: {
    detail: number;
    enabled: boolean;
    intensity: number;
    multiplier: number;
  },
) {
  displacementFilter.enabled = input.enabled;
  displacementFilter.padding = 110 * input.multiplier;
  displacementFilter.scale.x = input.intensity * input.multiplier;
  displacementFilter.scale.y = input.intensity * input.multiplier * 10;
  displacementSprite.scale.set(input.detail, input.detail);
}

export function updateDropShadowFilters(
  filters: ReturnType<typeof createVisualizerDropShadowFilters>,
  input: {
    blur: number;
    color: string;
    enabled: boolean;
    glowEnabled: boolean;
    multiplier: number;
    opacity: number;
  },
) {
  const glowShadowEnabled = input.glowEnabled && input.enabled;
  const waveShadowEnabled = !input.glowEnabled && input.enabled;
  const blur = input.blur * input.multiplier;
  const color = toPixiColor(input.color);

  filters.glowShadowFilter1.enabled = glowShadowEnabled;
  filters.glowShadowFilter2.enabled = glowShadowEnabled;
  filters.waveShadowFilter1.enabled = waveShadowEnabled;
  filters.waveShadowFilter2.enabled = waveShadowEnabled;
  filters.waveShadowPaddingFilter.enabled = waveShadowEnabled;
  filters.waveShadowPaddingFilter.padding = 100 * input.multiplier;

  for (const filter of [
    filters.glowShadowFilter1,
    filters.glowShadowFilter2,
    filters.waveShadowFilter1,
    filters.waveShadowFilter2,
  ]) {
    filter.blur = blur;
    filter.alpha = input.opacity;
    filter.color = color;
  }
}

export function updateLogoSprite(
  sprite: Sprite,
  texture: Texture,
  size: number,
  position: number,
) {
  if (sprite.texture !== texture) {
    sprite.texture = texture;
  }

  sprite.width = size;
  sprite.height = size;
  sprite.x = position;
  sprite.y = position;
}
