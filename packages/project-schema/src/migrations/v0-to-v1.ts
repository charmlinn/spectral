import { VIDEO_PROJECT_SCHEMA_VERSION } from "../constants";
import { normalizeVideoProject } from "../normalize";
import type { VideoProject } from "../schema";

type LegacyV0Project = Record<string, unknown> & {
  schemaVersion?: number;
  text?: {
    textElements?: unknown[];
  };
  exportSettings?: Record<string, unknown>;
};

export function migrateVideoProjectV0ToV1(input: LegacyV0Project): VideoProject {
  return normalizeVideoProject({
    ...input,
    version: VIDEO_PROJECT_SCHEMA_VERSION,
    textLayers: Array.isArray(input.text?.textElements) ? input.text.textElements : [],
    export: input.exportSettings ?? input.export,
  });
}
