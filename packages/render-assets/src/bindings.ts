import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { RenderSessionAssetBinding } from "@spectral/render-session";

import type { MaterializedRenderAssetBinding } from "./contracts";
import { inferFileExtension, sanitizePathSegment } from "./materialized-asset";

async function writeRemoteAssetToFile(input: {
  sourceUrl: string;
  localPath: string;
  fetchImpl: typeof globalThis.fetch;
}): Promise<void> {
  const response = await input.fetchImpl(input.sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to download ${input.sourceUrl}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(input.localPath, buffer);
}

export async function materializeAssetBinding(input: {
  binding: RenderSessionAssetBinding;
  workspaceDir: string;
  fetchImpl: typeof globalThis.fetch;
}): Promise<MaterializedRenderAssetBinding> {
  const binding = input.binding;

  if (binding.status !== "ready" || !binding.resolvedUrl) {
    return {
      role: binding.role,
      assetId: binding.assetId,
      kind: binding.kind,
      status: binding.status,
      storageKey: binding.storageKey,
      mimeType: binding.mimeType,
      sourceUrl: binding.resolvedUrl,
      localPath: null,
    };
  }

  const assetsDir = join(input.workspaceDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const extension = inferFileExtension({
    mimeType: binding.mimeType,
    sourceUrl: binding.resolvedUrl,
    storageKey: binding.storageKey,
    fallback: binding.kind === "font" ? "woff2" : "bin",
  });
  const fileName = [
    sanitizePathSegment(binding.role),
    sanitizePathSegment(binding.assetId),
    `${sanitizePathSegment(binding.kind)}.${extension}`,
  ].join("-");
  const localPath = join(assetsDir, fileName);

  await writeRemoteAssetToFile({
    sourceUrl: binding.resolvedUrl,
    localPath,
    fetchImpl: input.fetchImpl,
  });

  return {
    role: binding.role,
    assetId: binding.assetId,
    kind: binding.kind,
    status: binding.status,
    storageKey: binding.storageKey,
    mimeType: binding.mimeType,
    sourceUrl: binding.resolvedUrl,
    localPath,
  };
}
