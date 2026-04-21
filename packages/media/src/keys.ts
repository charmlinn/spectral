function sanitizeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function normalizeExtension(extension: string): string {
  const normalized = extension.startsWith(".") ? extension.slice(1) : extension;
  return sanitizeSegment(normalized.toLowerCase());
}

export function buildProjectAssetStorageKey(input: {
  projectId: string;
  assetId: string;
  extension: string;
}): string {
  return [
    "projects",
    sanitizeSegment(input.projectId),
    "assets",
    sanitizeSegment(input.assetId),
    `source.${normalizeExtension(input.extension)}`,
  ].join("/");
}

export function buildAudioWaveformStorageKey(input: {
  projectId: string;
  assetId: string;
}): string {
  return [
    "projects",
    sanitizeSegment(input.projectId),
    "analysis",
    sanitizeSegment(input.assetId),
    "waveform.json",
  ].join("/");
}

export function buildAudioSpectrumStorageKey(input: {
  projectId: string;
  assetId: string;
}): string {
  return [
    "projects",
    sanitizeSegment(input.projectId),
    "analysis",
    sanitizeSegment(input.assetId),
    "spectrum.json",
  ].join("/");
}

export function buildExportChunkStorageKey(input: {
  projectId: string;
  exportJobId: string;
  chunkIndex: number;
  extension?: string;
}): string {
  return [
    "projects",
    sanitizeSegment(input.projectId),
    "exports",
    sanitizeSegment(input.exportJobId),
    "chunks",
    `${input.chunkIndex}.${normalizeExtension(input.extension ?? "mp4")}`,
  ].join("/");
}

export function buildExportOutputStorageKey(input: {
  projectId: string;
  exportJobId: string;
  extension?: string;
}): string {
  return [
    "projects",
    sanitizeSegment(input.projectId),
    "exports",
    sanitizeSegment(input.exportJobId),
    "final",
    `output.${normalizeExtension(input.extension ?? "mp4")}`,
  ].join("/");
}

export function buildExportPosterStorageKey(input: {
  projectId: string;
  exportJobId: string;
  extension?: string;
}): string {
  return [
    "projects",
    sanitizeSegment(input.projectId),
    "exports",
    sanitizeSegment(input.exportJobId),
    "thumb",
    `poster.${normalizeExtension(input.extension ?? "jpg")}`,
  ].join("/");
}

export function inferExtensionFromFilename(filename: string, fallback = "bin"): string {
  const lastSegment = filename.split(".").pop();

  if (!lastSegment || lastSegment === filename) {
    return fallback;
  }

  return normalizeExtension(lastSegment);
}
