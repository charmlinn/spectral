import type {
  ParticleItemSettings,
  ParticleSettings,
} from "@spectral/project-schema";

export type ParticleTextureConfig = Pick<
  ParticleItemSettings,
  | "birthRate"
  | "color"
  | "maxOpacity"
  | "maxSize"
  | "mediaData"
  | "minOpacity"
  | "minSize"
  | "shape"
>;

function resolveLegacyParticleShape(items: string | null | undefined) {
  const normalized = items?.trim().toLowerCase() ?? "dots";

  if (normalized.includes("heart")) {
    return "heart";
  }

  if (normalized.includes("star")) {
    return "star";
  }

  if (normalized.includes("emoji")) {
    return "emoji";
  }

  if (normalized.includes("custom")) {
    return "custom";
  }

  return "circle";
}

export function buildParticleTextureConfigs(
  settings: ParticleSettings | null | undefined,
): ParticleTextureConfig[] {
  if (!settings) {
    return [];
  }

  if (Array.isArray(settings.items)) {
    return settings.items.map((item) => ({
      birthRate: item.birthRate,
      color: item.color,
      maxOpacity: item.maxOpacity,
      maxSize: item.maxSize,
      mediaData: item.mediaData,
      minOpacity: item.minOpacity,
      minSize: item.minSize,
      shape: item.shape,
    }));
  }

  return [
    {
      birthRate: settings.birthRate,
      color: settings.color,
      maxOpacity: settings.maxOpacity,
      maxSize: settings.maxSize,
      mediaData: null,
      minOpacity: settings.minOpacity,
      minSize: settings.minSize,
      shape: resolveLegacyParticleShape(settings.items),
    },
  ];
}
