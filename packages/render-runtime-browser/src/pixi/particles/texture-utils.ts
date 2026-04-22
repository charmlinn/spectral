import { Texture } from "pixi.js";

import { PARTICLE_ASSETS } from "./particle-assets";

const mediaTextureCache = new Map<string, Texture>();

function createCachedTexture(imageUrl: string) {
  const cached = mediaTextureCache.get(imageUrl);

  if (cached) {
    return cached;
  }

  const texture = Texture.from(imageUrl);
  mediaTextureCache.set(imageUrl, texture);
  return texture;
}

export function createMediaTexture(
  shape: string | null | undefined,
  mediaData: string | null | undefined,
) {
  const normalizedShape = shape?.trim().toLowerCase();

  if (
    mediaData &&
    (normalizedShape === "emoji" || normalizedShape === "custom")
  ) {
    return createCachedTexture(mediaData);
  }

  return null;
}

export function clearAllTextures() {
  for (const texture of mediaTextureCache.values()) {
    texture.destroy(true);
  }

  mediaTextureCache.clear();
}

export function getDefaultTextures() {
  return {
    circleTexture1: Texture.from(PARTICLE_ASSETS.CIRCLE_GLOW),
    circleTexture2: Texture.from(PARTICLE_ASSETS.CIRCLE_BASIC),
    heartTexture1: Texture.from(PARTICLE_ASSETS.HEART_GLOW),
    heartTexture2: Texture.from(PARTICLE_ASSETS.HEART_BASIC),
    starTexture1: Texture.from(PARTICLE_ASSETS.STAR_GLOW),
    starTexture2: Texture.from(PARTICLE_ASSETS.STAR_BASIC),
  };
}

