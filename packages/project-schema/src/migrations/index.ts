import { VIDEO_PROJECT_SCHEMA_VERSION } from "../constants";
import { normalizeVideoProject } from "../normalize";
import {
  isLegacySpecterrPreset,
  legacyPresetToVideoProject,
  type LegacySpecterrPreset,
} from "../legacy/specterr-preset";
import type { VideoProject } from "../schema";
import { migrateVideoProjectV0ToV1 } from "./v0-to-v1";

function extractVersion(input: Record<string, unknown>): number {
  const version = input.version ?? input.schemaVersion;

  if (typeof version === "number") {
    return version;
  }

  return 0;
}

export function migrateVideoProjectDocument(input: unknown): VideoProject {
  if (isLegacySpecterrPreset(input)) {
    return legacyPresetToVideoProject(input as LegacySpecterrPreset);
  }

  if (typeof input !== "object" || input === null) {
    return normalizeVideoProject({});
  }

  const document = input as Record<string, unknown>;
  const version = extractVersion(document);

  if (version <= 0) {
    return migrateVideoProjectV0ToV1(document);
  }

  if (version === VIDEO_PROJECT_SCHEMA_VERSION) {
    return normalizeVideoProject(document);
  }

  throw new Error(`Unsupported VideoProject version: ${version}`);
}
