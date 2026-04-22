import type { TextStyle as ProjectTextStyle } from "@spectral/project-schema";
import type { RenderSurface } from "@spectral/render-core";

import { clamp } from "../adapters/canvas-utils";

export const SPECTERR_BASE_HEIGHT = 500;

const DEFAULT_FALLBACK_FONTS = [
  "Arial",
  "Noto Sans",
  "Noto Sans CJK SC",
  "Noto Sans CJK TC",
  "Microsoft YaHei",
  "SimHei",
  "Noto Sans Sinhala",
  "Helvetica",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "sans-serif",
];

export function getSurfaceMultiplier(surface: RenderSurface) {
  return surface.height / SPECTERR_BASE_HEIGHT;
}

export function toPixiColor(input: string | null | undefined) {
  if (!input) {
    return 0xffffff;
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    return Number.parseInt(normalized.slice(1), 16);
  }

  if (normalized.startsWith("0x")) {
    return Number.parseInt(normalized.slice(2), 16);
  }

  const parsed = Number.parseInt(normalized, 16);

  return Number.isFinite(parsed) ? parsed : 0xffffff;
}

export function getTextAnchor(anchorPoint: string | null | undefined) {
  const normalized = anchorPoint?.trim().toLowerCase();

  if (normalized === "left") {
    return 0;
  }

  if (normalized === "right") {
    return 1;
  }

  return 0.5;
}

export function getTextAlign(anchorPoint: string | null | undefined) {
  const normalized = anchorPoint?.trim().toLowerCase();

  if (normalized === "left") {
    return "left";
  }

  if (normalized === "right") {
    return "right";
  }

  return "center";
}

export function getTextDropShadow(
  style: ProjectTextStyle,
  multiplier: number,
) {
  if (!style.shadow.enabled) {
    return false;
  }

  return {
    alpha: clamp(style.shadow.opacity, 0, 1),
    angle: Math.PI / 4,
    blur: style.shadow.blur * multiplier * 2,
    color: toPixiColor(style.shadow.color),
    distance: 0,
  };
}

export function getFontFamilyChain(fontFamily: string | null | undefined) {
  return [fontFamily, ...DEFAULT_FALLBACK_FONTS].filter(
    (value): value is string => Boolean(value),
  );
}

export function primeFont(style: ProjectTextStyle, multiplier: number) {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return;
  }

  const weight = style.bold ? "700" : "400";
  const size = Math.max(1, style.fontSize * multiplier * 2);

  void document.fonts
    .load(`${weight} ${size}px "${style.font}"`)
    .catch(() => undefined);
}
