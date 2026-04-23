import type {
  RenderSession,
  RenderSessionAssetBinding,
  RenderSessionAudioAnalysisSnapshot,
} from "@spectral/render-session";

export type MaterializedRenderAssetBinding = {
  role: RenderSessionAssetBinding["role"];
  assetId: string;
  kind: RenderSessionAssetBinding["kind"];
  status: RenderSessionAssetBinding["status"];
  storageKey: string;
  mimeType: string | null;
  sourceUrl: string | null;
  localPath: string | null;
};

export type MaterializedRenderFontAsset = {
  family: string;
  style: string | null;
  weight: string | number | null;
  fallbackFamilies: string[];
  assetId: string | null;
  storageKey: string | null;
  sourceUrl: string | null;
  localPath: string | null;
};

export type MaterializedRenderAudioAnalysis = {
  analysisId: string | null;
  snapshot: RenderSessionAudioAnalysisSnapshot | null;
  snapshotPath: string | null;
};

export type MaterializedRenderAssets = {
  session: RenderSession;
  workspaceDir: string;
  assetBindings: MaterializedRenderAssetBinding[];
  fonts: MaterializedRenderFontAsset[];
  audioAnalysis: MaterializedRenderAudioAnalysis | null;
  warnings: string[];
};

export type MaterializeRenderAssetsOptions = {
  session: RenderSession;
  workspaceDir: string;
  fetch?: typeof globalThis.fetch;
  overwrite?: boolean;
};
