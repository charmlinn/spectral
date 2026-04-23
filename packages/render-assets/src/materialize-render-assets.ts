import type {
  MaterializeRenderAssetsOptions,
  MaterializedRenderAssetBinding,
  MaterializedRenderAssets,
  MaterializedRenderFontAsset,
} from "./contracts";
import { materializeAudioAnalysis } from "./audio-analysis";
import { materializeAssetBinding } from "./bindings";
import { materializeFontAsset } from "./fonts";

export async function materializeRenderAssets(
  options: MaterializeRenderAssetsOptions,
): Promise<MaterializedRenderAssets> {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required to materialize render assets.");
  }

  const warnings: string[] = [];
  const assetBindings: MaterializedRenderAssetBinding[] = [];

  for (const binding of options.session.assets.bindings) {
    const materialized = await materializeAssetBinding({
      binding,
      workspaceDir: options.workspaceDir,
      fetchImpl,
    });

    if (!materialized.localPath && materialized.status === "ready" && materialized.sourceUrl) {
      warnings.push(`Asset ${materialized.assetId} was ready but did not materialize locally.`);
    }

    assetBindings.push(materialized);
  }

  const fonts: MaterializedRenderFontAsset[] = [];

  for (const font of options.session.assets.fonts) {
    const materialized = await materializeFontAsset({
      font,
      workspaceDir: options.workspaceDir,
      fetchImpl,
    });

    fonts.push(materialized);
  }

  const audioAnalysis = await materializeAudioAnalysis({
    audioAnalysis: options.session.assets.audioAnalysis,
    workspaceDir: options.workspaceDir,
  });

  return {
    session: options.session,
    workspaceDir: options.workspaceDir,
    assetBindings,
    fonts,
    audioAnalysis,
    warnings,
  };
}
