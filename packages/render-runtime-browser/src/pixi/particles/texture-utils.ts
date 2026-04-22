import { Texture } from "pixi.js";

const mediaTextureCache = new Map<string, Texture>();
let defaultTexturesCache: ReturnType<typeof createDefaultTextures> | null = null;

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

  if (defaultTexturesCache) {
    for (const texture of Object.values(defaultTexturesCache)) {
      texture.destroy(true);
    }

    defaultTexturesCache = null;
  }
}

function createCanvasTexture(
  key: string,
  draw: (context: CanvasRenderingContext2D, size: number) => void,
) {
  const cached = mediaTextureCache.get(key);

  if (cached) {
    return cached;
  }

  if (typeof document === "undefined") {
    return Texture.WHITE;
  }

  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    return Texture.WHITE;
  }

  draw(context, size);

  const texture = Texture.from(canvas, true);
  mediaTextureCache.set(key, texture);
  return texture;
}

function drawCircleTexture(
  context: CanvasRenderingContext2D,
  size: number,
  glowing: boolean,
) {
  const center = size / 2;
  const radius = size * (glowing ? 0.28 : 0.22);

  context.clearRect(0, 0, size, size);
  context.fillStyle = "#ffffff";

  if (glowing) {
    const gradient = context.createRadialGradient(
      center,
      center,
      radius * 0.2,
      center,
      center,
      size * 0.42,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.9)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(center, center, size * 0.42, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fill();
}

function drawHeartPath(
  context: CanvasRenderingContext2D,
  center: number,
  size: number,
) {
  const heartWidth = size * 0.22;
  const heartHeight = size * 0.2;

  context.beginPath();
  context.moveTo(center, center + heartHeight * 0.9);
  context.bezierCurveTo(
    center - heartWidth * 2,
    center - heartHeight * 0.2,
    center - heartWidth * 1.2,
    center - heartHeight * 2,
    center,
    center - heartHeight * 0.55,
  );
  context.bezierCurveTo(
    center + heartWidth * 1.2,
    center - heartHeight * 2,
    center + heartWidth * 2,
    center - heartHeight * 0.2,
    center,
    center + heartHeight * 0.9,
  );
  context.closePath();
}

function drawStarPath(
  context: CanvasRenderingContext2D,
  center: number,
  size: number,
) {
  const spikes = 5;
  const outerRadius = size * 0.24;
  const innerRadius = outerRadius * 0.48;

  context.beginPath();

  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = (index * Math.PI) / spikes - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
}

function drawShapedTexture(
  context: CanvasRenderingContext2D,
  size: number,
  shape: "heart" | "star",
  glowing: boolean,
) {
  const center = size / 2;
  context.clearRect(0, 0, size, size);

  if (glowing) {
    context.shadowBlur = size * 0.18;
    context.shadowColor = "rgba(255,255,255,0.95)";
  }

  context.fillStyle = "#ffffff";

  if (shape === "heart") {
    drawHeartPath(context, center, size);
  } else {
    drawStarPath(context, center, size);
  }

  context.fill();
  context.shadowBlur = 0;
  context.shadowColor = "transparent";
}

function createDefaultTextures() {
  return {
    circleTexture1: createCanvasTexture("particle-circle-glow", (context, size) =>
      drawCircleTexture(context, size, true),
    ),
    circleTexture2: createCanvasTexture("particle-circle-basic", (context, size) =>
      drawCircleTexture(context, size, false),
    ),
    heartTexture1: createCanvasTexture("particle-heart-glow", (context, size) =>
      drawShapedTexture(context, size, "heart", true),
    ),
    heartTexture2: createCanvasTexture("particle-heart-basic", (context, size) =>
      drawShapedTexture(context, size, "heart", false),
    ),
    starTexture1: createCanvasTexture("particle-star-glow", (context, size) =>
      drawShapedTexture(context, size, "star", true),
    ),
    starTexture2: createCanvasTexture("particle-star-basic", (context, size) =>
      drawShapedTexture(context, size, "star", false),
    ),
  };
}

export function getDefaultTextures() {
  if (!defaultTexturesCache) {
    defaultTexturesCache = createDefaultTextures();
  }

  return defaultTexturesCache;
}
