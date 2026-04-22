import {
  getAspectRatioDimensions,
  normalizeLegacySpecterrAspectRatio,
} from "../aspect-ratio";
import { LEGACY_SPECTERR_PRESET_VERSION } from "../constants";
import { createDefaultVideoProject } from "../defaults";
import { normalizeVideoProject } from "../normalize";
import type { MediaReference, TextLayer, VideoProject } from "../schema";

type LegacyMediaSource = {
  mediaId?: string | null;
  data?: {
    url?: string | null;
    originalImageUrl?: string | null;
    k4Url?: string | null;
    p1080Url?: string | null;
    p720Url?: string | null;
    p540Url?: string | null;
    p360Url?: string | null;
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

export function isLegacySpecterrPreset(
  value: unknown,
): value is LegacySpecterrPreset {
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
  defaultKind: MediaReference["kind"] = "unknown",
): MediaReference | null {
  const videoUrl =
    mediaSource?.data?.p1080Url ??
    mediaSource?.data?.k4Url ??
    mediaSource?.data?.p720Url ??
    mediaSource?.data?.p540Url ??
    mediaSource?.data?.p360Url ??
    null;
  const imageUrl =
    mediaSource?.data?.url ??
    mediaSource?.data?.originalImageUrl ??
    fallbackUrl ??
    null;
  const kind = mediaSource?.mediaResourceType === 1 ? "video" : defaultKind;
  const url =
    kind === "video" ? (videoUrl ?? imageUrl) : (imageUrl ?? videoUrl);

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
  };
}

function legacyAspectRatioToViewport(code: number | undefined) {
  const aspectRatio = normalizeLegacySpecterrAspectRatio(code);
  const dimensions = getAspectRatioDimensions(aspectRatio);

  return {
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio,
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

function sanitizeVisualizerSettings(
  defaults: VideoProject["visualizer"],
  settings: LegacySpecterrPreset["settings"],
): VideoProject["visualizer"] {
  const { mediaSource, logoUrl, ...visualizerRest } =
    settings?.visualizer ?? {};
  void mediaSource;
  void logoUrl;

  return {
    ...defaults,
    ...visualizerRest,
    glowType:
      typeof settings?.visualizer?.glowType === "string"
        ? settings.visualizer.glowType
        : defaults.glowType,
  };
}

function sanitizeBackdropSettings(
  defaults: VideoProject["backdrop"],
  settings: LegacySpecterrPreset["settings"],
): VideoProject["backdrop"] {
  const {
    mediaSource,
    url,
    reflection: ignoredReflection,
    ...backgroundRest
  } = settings?.background ?? {};
  void mediaSource;
  void url;
  void ignoredReflection;
  const reflection = settings?.background?.reflection as
    | {
        type?: unknown;
        direction?: unknown;
      }
    | undefined;

  return {
    ...defaults,
    ...backgroundRest,
    reflection: {
      ...defaults.reflection,
      type:
        reflection && typeof reflection.type === "string"
          ? reflection.type
          : defaults.reflection.type,
      direction:
        reflection && typeof reflection.direction === "string"
          ? reflection.direction
          : defaults.reflection.direction,
    },
  };
}

function sanitizeLyricsStyle(
  defaults: VideoProject["lyrics"]["style"],
  settings: LegacySpecterrPreset["settings"],
): VideoProject["lyrics"]["style"] {
  const style = settings?.lyrics?.style;
  const {
    shadow: ignoredShadow,
    position: ignoredPosition,
    drift: ignoredDrift,
    ...styleRest
  } = style ?? {};
  void ignoredShadow;
  void ignoredPosition;
  void ignoredDrift;
  const shadow =
    style && typeof style.shadow === "object" && style.shadow !== null
      ? style.shadow
      : defaults.shadow;
  const position =
    style && typeof style.position === "object" && style.position !== null
      ? style.position
      : defaults.position;
  const drift =
    style && typeof style.drift === "object" && style.drift !== null
      ? style.drift
      : defaults.drift;

  return {
    ...defaults,
    ...styleRest,
    text: typeof style?.text === "string" ? style.text : defaults.text,
    shadow: {
      ...defaults.shadow,
      ...shadow,
    },
    position: {
      ...defaults.position,
      ...position,
    },
    drift: {
      ...defaults.drift,
      ...drift,
    },
  };
}

function sanitizeParticleSettings(
  defaults: VideoProject["overlays"]["particles"],
  settings: LegacySpecterrPreset["settings"],
): VideoProject["overlays"]["particles"] {
  const particles = settings?.elements?.particles;

  return {
    ...defaults,
    ...(particles ?? {}),
    items:
      typeof particles?.items === "string" ? particles.items : defaults.items,
  };
}

function sanitizeYouTubeCtaSettings(
  defaults: VideoProject["overlays"]["youTubeCta"],
  settings: LegacySpecterrPreset["settings"],
): VideoProject["overlays"]["youTubeCta"] {
  const youTubeCta = settings?.elements?.youTubeCta;

  return {
    ...defaults,
    ...(youTubeCta ?? {}),
    cornerPosition:
      typeof youTubeCta?.cornerPosition === "string"
        ? youTubeCta.cornerPosition
        : defaults.cornerPosition,
  };
}

export function legacyPresetToVideoProject(
  preset: LegacySpecterrPreset,
): VideoProject {
  const settings = preset.settings ?? {};
  const defaults = createDefaultVideoProject();
  const viewport = legacyAspectRatioToViewport(settings.aspectRatio);
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
      ...viewport,
    },
    visualizer: {
      ...sanitizeVisualizerSettings(defaults.visualizer, settings),
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
      ...sanitizeBackdropSettings(defaults.backdrop, settings),
      source: backgroundSource,
    },
    lyrics: {
      style: sanitizeLyricsStyle(defaults.lyrics.style, settings),
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
      particles: sanitizeParticleSettings(
        defaults.overlays.particles,
        settings,
      ),
      youTubeCta: sanitizeYouTubeCtaSettings(
        defaults.overlays.youTubeCta,
        settings,
      ),
      emojiImages: settings.emojiImages ?? [],
    },
    export: {
      ...defaults.export,
      ...(settings.export ?? {}),
      width: viewport.width,
      height: viewport.height,
    },
    source: {
      legacyPresetId: preset.id,
      legacyPresetVersion:
        settings.version ?? String(LEGACY_SPECTERR_PRESET_VERSION),
      legacyAspectRatioCode: settings.aspectRatio ?? null,
    },
  });
}
