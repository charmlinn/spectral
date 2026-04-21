import { LEGACY_SPECTERR_PRESET_VERSION } from "../constants";
import { createDefaultVideoProject } from "../defaults";
import { normalizeVideoProject } from "../normalize";
import type { MediaReference, TextLayer, VideoProject } from "../schema";

type LegacyMediaSource = {
  mediaId?: string | null;
  data?: {
    url?: string | null;
  } | null;
  mediaSourceType?: number | null;
  mediaResourceType?: number | null;
  isPremium?: boolean | null;
  isPreset?: boolean | null;
};

type LegacyTextElement = {
  text?: string;
  color?: string;
  anchorPoint?: string;
  font?: string;
  fontSize?: number;
  bold?: boolean;
  shadow?: Record<string, unknown>;
  position?: Record<string, unknown>;
  drift?: Record<string, unknown>;
};

export type LegacySpecterrPreset = {
  recentlyAdded?: boolean;
  popularity?: number;
  isPremium?: boolean;
  id: string;
  name: string;
  thumbnailUrl?: string | null;
  plainThumbnailUrl?: string | null;
  exampleUrl?: string | null;
  enabled?: boolean;
  createdTime?: string;
  videos?: unknown[];
  priority?: number;
  settings?: {
    id?: string;
    presetId?: string;
    pipeline?: string;
    export?: Record<string, unknown> | null;
    visualizer?: Record<string, unknown> & {
      logoUrl?: string | null;
      mediaSource?: LegacyMediaSource | null;
    };
    particles?: Record<string, unknown> | null;
    background?: Record<string, unknown> & {
      url?: string | null;
      mediaSource?: LegacyMediaSource | null;
    };
    text?: {
      textElements?: LegacyTextElement[];
    };
    lyrics?: {
      style?: LegacyTextElement;
      segments?: Array<Record<string, unknown>>;
    };
    elements?: {
      particles?: Record<string, unknown>;
      youTubeCta?: Record<string, unknown>;
    };
    version?: string;
    thumbnailUrl?: string | null;
    aspectRatio?: number;
    emojiImages?: unknown[];
  };
};

export function isLegacySpecterrPreset(value: unknown): value is LegacySpecterrPreset {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "settings" in value
  );
}

function legacyMediaSourceToReference(
  mediaSource: LegacyMediaSource | null | undefined,
  fallbackUrl?: string | null,
  kind: MediaReference["kind"] = "unknown",
): MediaReference | null {
  const url = mediaSource?.data?.url ?? fallbackUrl ?? null;

  if (!mediaSource?.mediaId && !url) {
    return null;
  }

  return {
    assetId: mediaSource?.mediaId ?? null,
    storageKey: null,
    url,
    kind,
    origin: url ? "legacy-url" : "unknown",
    mimeType: null,
    mediaSourceType: mediaSource?.mediaSourceType ?? null,
    mediaResourceType: mediaSource?.mediaResourceType ?? null,
    isPremium: mediaSource?.isPremium ?? false,
    isPreset: mediaSource?.isPreset ?? false,
  };
}

function legacyAspectRatioToViewport(code: number | undefined) {
  if (code === 0 || code === undefined) {
    return {
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
    };
  }

  return {
    width: 1080,
    height: 1080,
    aspectRatio: `legacy-${code}`,
  };
}

function toTextLayer(element: LegacyTextElement, index: number): TextLayer {
  return {
    id: `text-${index + 1}`,
    visible: true,
    startMs: 0,
    endMs: null,
    style: {
      text: element.text ?? "",
      color: element.color ?? "#ffffff",
      anchorPoint: element.anchorPoint ?? "center",
      font: element.font ?? "Montserrat",
      fontSize: element.fontSize ?? 48,
      bold: element.bold ?? false,
      shadow: {
        enabled: false,
        color: "#000000",
        blur: 0,
        opacity: 1,
        ...(element.shadow ?? {}),
      },
      position: {
        x: 0,
        y: 0,
        ...(element.position ?? {}),
      },
      drift: {
        enabled: false,
        intensity: 0,
        customMode: false,
        amplitudeX: 0,
        amplitudeY: 0,
        rotation: 0,
        speed: 0,
        octaves: 1,
        scale: 1,
        acceleration: 0,
        ...(element.drift ?? {}),
      },
    },
  };
}

export function legacyPresetToVideoProject(preset: LegacySpecterrPreset): VideoProject {
  const settings = preset.settings ?? {};
  const defaults = createDefaultVideoProject();
  const visualizerMedia = legacyMediaSourceToReference(
    settings.visualizer?.mediaSource,
    undefined,
    "image",
  );
  const backgroundSource = legacyMediaSourceToReference(
    settings.background?.mediaSource,
    settings.background?.url,
    "image",
  );

  return normalizeVideoProject({
    ...defaults,
    projectId: preset.id,
    createdAt: preset.createdTime ?? defaults.createdAt,
    updatedAt: preset.createdTime ?? defaults.updatedAt,
    meta: {
      ...defaults.meta,
      name: preset.name,
      presetId: preset.id,
      source: "preset",
      tags: [
        preset.recentlyAdded ? "recently-added" : null,
        preset.isPremium ? "premium" : "free",
      ].filter((value): value is string => value !== null),
      enabled: preset.enabled ?? true,
      popularity: preset.popularity ?? 0,
      priority: preset.priority ?? 0,
      exampleUrl: preset.exampleUrl ?? null,
      thumbnailUrl: preset.thumbnailUrl ?? preset.plainThumbnailUrl ?? null,
    },
    viewport: {
      ...defaults.viewport,
      ...legacyAspectRatioToViewport(settings.aspectRatio),
    },
    visualizer: {
      ...defaults.visualizer,
      ...settings.visualizer,
      enabled: true,
      pipeline: settings.pipeline ?? defaults.visualizer.pipeline,
      mediaSource: visualizerMedia,
      logoSource: settings.visualizer?.logoUrl
        ? {
            assetId: null,
            storageKey: null,
            url: settings.visualizer.logoUrl,
            kind: "logo",
            origin: "legacy-url",
            mimeType: null,
          }
        : null,
    },
    backdrop: {
      ...defaults.backdrop,
      ...(settings.background ?? {}),
      source: backgroundSource,
    },
    lyrics: {
      style: {
        ...defaults.lyrics.style,
        ...(settings.lyrics?.style ?? {}),
      },
      segments: (settings.lyrics?.segments ?? []).map((segment, index) => ({
        id: `lyric-${index + 1}`,
        startMs: Number(segment.startTime ?? segment.startMs ?? 0),
        endMs: Number(segment.endTime ?? segment.endMs ?? 0),
        text: String(segment.text ?? ""),
        ...segment,
      })),
    },
    textLayers: (settings.text?.textElements ?? []).map(toTextLayer),
    overlays: {
      particles: {
        ...defaults.overlays.particles,
        ...(settings.elements?.particles ?? {}),
      },
      youTubeCta: {
        ...defaults.overlays.youTubeCta,
        ...(settings.elements?.youTubeCta ?? {}),
      },
      emojiImages: settings.emojiImages ?? [],
    },
    export: {
      ...defaults.export,
      ...(settings.export ?? {}),
    },
    source: {
      legacyPresetId: preset.id,
      legacyPresetVersion: settings.version ?? String(LEGACY_SPECTERR_PRESET_VERSION),
      legacyAspectRatioCode: settings.aspectRatio ?? null,
    },
  });
}
