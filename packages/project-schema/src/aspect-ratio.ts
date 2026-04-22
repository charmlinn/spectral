export const supportedAspectRatios = ["1:1", "16:9", "9:16"] as const;

export type SupportedAspectRatio = (typeof supportedAspectRatios)[number];

const aspectRatioDimensions = {
  "1:1": {
    width: 1080,
    height: 1080,
  },
  "16:9": {
    width: 1920,
    height: 1080,
  },
  "9:16": {
    width: 1080,
    height: 1920,
  },
} satisfies Record<SupportedAspectRatio, { width: number; height: number }>;

const legacySpecterrAspectRatioMap = {
  0: "16:9",
  1: "9:16",
  2: "1:1",
} as const satisfies Record<number, SupportedAspectRatio>;

export function isSupportedAspectRatio(
  value: unknown,
): value is SupportedAspectRatio {
  return (
    typeof value === "string" &&
    supportedAspectRatios.includes(value as SupportedAspectRatio)
  );
}

export function getAspectRatioDimensions(aspectRatio: SupportedAspectRatio) {
  return aspectRatioDimensions[aspectRatio];
}

export function normalizeLegacySpecterrAspectRatio(
  code: number | null | undefined,
): SupportedAspectRatio {
  if (typeof code === "number" && code in legacySpecterrAspectRatioMap) {
    return legacySpecterrAspectRatioMap[
      code as keyof typeof legacySpecterrAspectRatioMap
    ];
  }

  return "1:1";
}

export function normalizeAspectRatio(value: unknown): SupportedAspectRatio {
  if (isSupportedAspectRatio(value)) {
    return value;
  }

  if (typeof value === "string") {
    if (value.startsWith("legacy-")) {
      return normalizeLegacySpecterrAspectRatio(
        Number(value.slice("legacy-".length)),
      );
    }

    if (value === "landscape") {
      return "16:9";
    }

    if (value === "portrait") {
      return "9:16";
    }

    if (value === "square") {
      return "1:1";
    }

    const numericCode = Number(value);
    if (Number.isFinite(numericCode)) {
      return normalizeLegacySpecterrAspectRatio(numericCode);
    }
  }

  if (typeof value === "number") {
    return normalizeLegacySpecterrAspectRatio(value);
  }

  return "1:1";
}
