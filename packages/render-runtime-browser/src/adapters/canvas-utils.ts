export const SPECTERR_VISUALIZER_BASE_HEIGHT = 500;
export const SPECTERR_VISUALIZER_BASE_RADIUS = 100;
export const SPECTERR_HISTORY_LIMIT = 7;
export const SPECTERR_BASS_BOUNCE_SCALE = 7;
export const SPECTERR_BASS_SHAKE_FACTOR_LITTLE = 250;
export const SPECTERR_BASS_SHAKE_FACTOR_LOT = 400;
export const SPECTERR_BASS_TARGET_MAX = 45;
export const SPECTERR_WIDE_BOUNCE_SCALE = 2;
export const SPECTERR_WIDE_SHAKE_FACTOR_LITTLE = 40;
export const SPECTERR_WIDE_SHAKE_FACTOR_LOT = 70;
export const SPECTERR_WIDE_TARGET_MAX = 185;
export const SPECTERR_BACKGROUND_BOUNCE_SCALE = -1.5;
export const SPECTERR_BACKGROUND_SHAKE_FACTOR = 300;
export const SPECTERR_BACKGROUND_PADDING_FACTOR = 1.1;
export const SPECTERR_BACKGROUND_MAX_VIGNETTE = 0.2;
export const SPECTERR_BACKGROUND_VIGNETTE_FACTOR = 5;
export const SPECTERR_BACKGROUND_MAX_CONTRAST = 1.2;
export const SPECTERR_BACKGROUND_CONTRAST_FACTOR = 6;
export const SPECTERR_BACKGROUND_MAX_ZOOM_BLUR = 0.5;
export const SPECTERR_BACKGROUND_ZOOM_BLUR_FACTOR = 1.7;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAmplitude(value: number) {
  return clamp(value / 255, 0, 1);
}

export function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function toColorString(
  input: string | null | undefined,
  alpha = 1,
): string {
  if (!input) {
    return `rgba(255,255,255,${alpha})`;
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    if (normalized.length === 4) {
      const red = normalized[1]!;
      const green = normalized[2]!;
      const blue = normalized[3]!;

      return `rgba(${Number.parseInt(red + red, 16)}, ${Number.parseInt(green + green, 16)}, ${Number.parseInt(blue + blue, 16)}, ${alpha})`;
    }

    if (normalized.length === 7) {
      return `rgba(${Number.parseInt(normalized.slice(1, 3), 16)}, ${Number.parseInt(normalized.slice(3, 5), 16)}, ${Number.parseInt(normalized.slice(5, 7), 16)}, ${alpha})`;
    }
  }

  const hexValue = normalized.startsWith("0x")
    ? normalized.slice(2)
    : normalized;
  const parsed = Number.parseInt(hexValue, 16);

  if (Number.isFinite(parsed)) {
    return `rgba(${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}, ${alpha})`;
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

export function mixColor(
  primary: string | null | undefined,
  secondary: string | null | undefined,
  mixPercent: number,
  alpha: number,
) {
  if (!secondary) {
    return toColorString(primary, alpha);
  }

  const from = toRgbTuple(primary);
  const to = toRgbTuple(secondary);
  const mix = clamp(mixPercent, 0, 1);

  return `rgba(${Math.round(from.red + (to.red - from.red) * mix)}, ${Math.round(from.green + (to.green - from.green) * mix)}, ${Math.round(from.blue + (to.blue - from.blue) * mix)}, ${alpha})`;
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getReflectionAngles(type: string | null | undefined): number[] {
  const normalized = type?.toLowerCase() ?? "none";

  if (normalized.includes("four") || normalized.includes("combo")) {
    return [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  }

  if (normalized.includes("three")) {
    return [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  }

  if (normalized.includes("slanted")) {
    return [0, Math.PI / 4];
  }

  if (
    normalized.includes("vertical") ||
    normalized.includes("2 side") ||
    normalized.includes("1 side")
  ) {
    return [0, Math.PI];
  }

  return [0];
}

export function getBackdropMirrorAxes(direction: string | null | undefined) {
  const normalized = direction?.toLowerCase() ?? "down";

  if (normalized.includes("left") || normalized.includes("right")) {
    return { x: -1, y: 1 };
  }

  return { x: 1, y: -1 };
}
