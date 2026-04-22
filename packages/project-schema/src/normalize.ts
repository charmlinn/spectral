import { getAspectRatioDimensions, normalizeAspectRatio } from "./aspect-ratio";
import { createDefaultVideoProject } from "./defaults";
import { videoProjectSchema, type VideoProject } from "./schema";

type Primitive = string | number | boolean | null | undefined;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeValue<T>(base: T, incoming: unknown): T {
  if (incoming === undefined) {
    return base;
  }

  if (Array.isArray(base) && Array.isArray(incoming)) {
    return incoming as T;
  }

  if (isPlainObject(base) && isPlainObject(incoming)) {
    const result: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(incoming)) {
      result[key] = mergeValue(result[key as keyof typeof result], value);
    }

    return result as T;
  }

  return incoming as T;
}

function normalizeTimestamp(
  value: string | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toISOString();
}

function normalizeHexColor(
  value: string | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  if (value.startsWith("0x")) {
    return `#${value.slice(2)}`;
  }

  return value;
}

function normalizeNullableHexColor(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return normalizeHexColor(value, "#ffffff");
}

export function normalizeVideoProject(input: unknown): VideoProject {
  const defaults = createDefaultVideoProject();
  const merged = mergeValue(defaults, input);
  const usesLegacyBlankEditorBackdropDefaults =
    merged.meta.source === "editor" &&
    merged.meta.presetId === null &&
    merged.source.legacyPresetId === null &&
    merged.backdrop.source === null &&
    merged.backdrop.bounceEnabled === false &&
    merged.backdrop.shakeEnabled === false &&
    merged.backdrop.filterEnabled === false &&
    merged.backdrop.vignetteEnabled === false &&
    merged.backdrop.contrastEnabled === false &&
    merged.backdrop.zoomBlurEnabled === false;
  const usesLegacyBlankEditorParticleDefaults =
    merged.meta.source === "editor" &&
    merged.meta.presetId === null &&
    merged.source.legacyPresetId === null &&
    merged.overlays.particles.enabled === false &&
    merged.overlays.particles.items === "dots" &&
    merged.overlays.particles.birthRate === 0 &&
    merged.overlays.particles.maxSize === 0 &&
    merged.overlays.particles.minSize === 0;
  const usesLegacyBackdropRuntimePlaceholders =
    merged.backdrop.paddingFactor === 1 &&
    merged.backdrop.shakeFactor === 18 &&
    merged.backdrop.bounceScale === 0 &&
    merged.backdrop.maxVignette === 0 &&
    merged.backdrop.vignetteFactor === 0 &&
    merged.backdrop.maxContrast === 1 &&
    merged.backdrop.contrastFactor === 0 &&
    merged.backdrop.maxZoomBlur === 0 &&
    merged.backdrop.zoomBlurFactor === 0;
  const shouldApplyLegacySpecterrBackdropDefaults =
    usesLegacyBackdropRuntimePlaceholders &&
    (
      merged.meta.source === "preset" ||
      merged.meta.source === "import" ||
      merged.meta.presetId !== null ||
      merged.source.legacyPresetId !== null
    );
  const normalizedAspectRatio = normalizeAspectRatio(
    merged.viewport.aspectRatio,
  );
  const defaultViewportDimensions = getAspectRatioDimensions(
    normalizedAspectRatio,
  );
  const shouldRealignViewport =
    merged.viewport.aspectRatio !== normalizedAspectRatio ||
    !Number.isFinite(merged.viewport.width) ||
    merged.viewport.width <= 0 ||
    !Number.isFinite(merged.viewport.height) ||
    merged.viewport.height <= 0;
  const normalized = {
    ...merged,
    createdAt: normalizeTimestamp(merged.createdAt, defaults.createdAt),
    updatedAt: normalizeTimestamp(merged.updatedAt, defaults.updatedAt),
    viewport: {
      ...merged.viewport,
      width: shouldRealignViewport
        ? defaultViewportDimensions.width
        : merged.viewport.width,
      height: shouldRealignViewport
        ? defaultViewportDimensions.height
        : merged.viewport.height,
      aspectRatio: normalizedAspectRatio,
    },
    backdrop: {
      ...merged.backdrop,
      ...(usesLegacyBlankEditorBackdropDefaults
        ? defaults.backdrop
        : {}),
      ...(shouldApplyLegacySpecterrBackdropDefaults
        ? {
            bounceScale: defaults.backdrop.bounceScale,
            paddingFactor: defaults.backdrop.paddingFactor,
            shakeFactor: defaults.backdrop.shakeFactor,
            maxVignette: defaults.backdrop.maxVignette,
            vignetteFactor: defaults.backdrop.vignetteFactor,
            maxContrast: defaults.backdrop.maxContrast,
            contrastFactor: defaults.backdrop.contrastFactor,
            maxZoomBlur: defaults.backdrop.maxZoomBlur,
            zoomBlurFactor: defaults.backdrop.zoomBlurFactor,
          }
        : {}),
    },
    overlays: {
      ...merged.overlays,
      particles: usesLegacyBlankEditorParticleDefaults
        ? defaults.overlays.particles
        : merged.overlays.particles,
    },
    lyrics: {
      ...merged.lyrics,
      style: {
        ...merged.lyrics.style,
        color: normalizeHexColor(
          merged.lyrics.style.color,
          defaults.lyrics.style.color,
        ),
      },
      segments: [...merged.lyrics.segments].sort(
        (left, right) => left.startMs - right.startMs,
      ),
    },
    textLayers: merged.textLayers.map((layer) => ({
      ...layer,
      style: {
        ...layer.style,
        color: normalizeHexColor(
          layer.style.color,
          defaults.lyrics.style.color,
        ),
      },
    })),
    visualizer: {
      ...merged.visualizer,
      waveCircles: merged.visualizer.waveCircles.map((circle) => ({
        ...circle,
        fillColor: normalizeHexColor(circle.fillColor, "0xffffff"),
        secondaryFillColor: normalizeNullableHexColor(circle.secondaryFillColor),
        lineColor: normalizeHexColor(circle.lineColor, "0xffffff"),
        secondaryLineColor: normalizeNullableHexColor(circle.secondaryLineColor),
      })),
    },
  };

  return videoProjectSchema.parse(normalized);
}

export function serializeVideoProject(project: VideoProject): string {
  return JSON.stringify(normalizeVideoProject(project));
}

export function parseVideoProject(payload: string): VideoProject {
  return normalizeVideoProject(JSON.parse(payload) as Primitive | object);
}
