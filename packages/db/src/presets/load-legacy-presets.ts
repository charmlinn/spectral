import { readFile } from "node:fs/promises";

import type { LegacyPresetsFile } from "./types";

export async function loadBundledLegacyPresets(): Promise<LegacyPresetsFile> {
  const url = new URL("./source/GetPresets.json", import.meta.url);
  const payload = await readFile(url, "utf8");

  return JSON.parse(payload) as LegacyPresetsFile;
}
