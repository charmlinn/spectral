import { inferExtensionFromFilename } from "@spectral/media";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "font/otf": "otf",
  "font/ttf": "ttf",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function inferFileExtension(input: {
  mimeType?: string | null;
  sourceUrl?: string | null;
  storageKey?: string | null;
  fallback?: string;
}): string {
  const mimeType = input.mimeType?.toLowerCase();

  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  if (input.sourceUrl) {
    try {
      const url = new URL(input.sourceUrl);
      return inferExtensionFromFilename(url.pathname, input.fallback ?? "bin");
    } catch {
      return inferExtensionFromFilename(input.sourceUrl, input.fallback ?? "bin");
    }
  }

  if (input.storageKey) {
    return inferExtensionFromFilename(input.storageKey, input.fallback ?? "bin");
  }

  return input.fallback ?? "bin";
}
