import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { RenderSessionFontManifestItem } from "@spectral/render-session";

import type { MaterializedRenderFontAsset } from "./contracts";
import { inferFileExtension, sanitizePathSegment } from "./materialized-asset";

export async function materializeFontAsset(input: {
  font: RenderSessionFontManifestItem;
  workspaceDir: string;
  fetchImpl: typeof globalThis.fetch;
}): Promise<MaterializedRenderFontAsset> {
  const font = input.font;

  if (!font.resolvedUrl) {
    return {
      family: font.family,
      style: font.style,
      weight: font.weight,
      fallbackFamilies: font.fallbackFamilies,
      assetId: font.assetId,
      storageKey: font.storageKey,
      sourceUrl: font.resolvedUrl,
      localPath: null,
    };
  }

  const fontsDir = join(input.workspaceDir, "fonts");
  await mkdir(fontsDir, { recursive: true });

  const extension = inferFileExtension({
    sourceUrl: font.resolvedUrl,
    storageKey: font.storageKey,
    fallback: "woff2",
  });
  const localPath = join(
    fontsDir,
    `${sanitizePathSegment(font.family)}-${font.assetId ? sanitizePathSegment(font.assetId) : "inline"}.${extension}`,
  );
  const response = await input.fetchImpl(font.resolvedUrl);

  if (!response.ok) {
    throw new Error(`Failed to download font ${font.family}: ${response.status}`);
  }

  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));

  return {
    family: font.family,
    style: font.style,
    weight: font.weight,
    fallbackFamilies: font.fallbackFamilies,
    assetId: font.assetId,
    storageKey: font.storageKey,
    sourceUrl: font.resolvedUrl,
    localPath,
  };
}
