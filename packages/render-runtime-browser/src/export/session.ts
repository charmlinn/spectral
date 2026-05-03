import {
  createArrayAudioAnalysisProvider,
  type AudioAnalysisProvider,
  type AudioAnalysisSnapshot,
  type SpectrumFrame,
  type WaveformOverview,
} from "@spectral/audio-analysis";
import type { RenderAssetResolver } from "@spectral/render-core";
import type {
  RenderSession,
  RenderSessionAudioAnalysisSnapshot,
  RenderSessionFontManifestItem,
} from "@spectral/render-session";

import { createCachedBrowserAssetResolver } from "../media/browser-asset-resolver";

function toWaveformOverview(
  snapshot: RenderSessionAudioAnalysisSnapshot,
): WaveformOverview {
  return {
    durationMs: snapshot.waveform.durationMs,
    sampleRate: snapshot.waveform.sampleRate,
    samplesPerPoint: snapshot.waveform.samplesPerPoint,
    points: snapshot.waveform.points,
  };
}

function toSpectrumFrames(
  frames: RenderSessionAudioAnalysisSnapshot["wideSpectrumFrames"],
): SpectrumFrame[] {
  return frames.map((frame) => ({
    frame: frame.frame,
    timeMs: frame.timeMs,
    values: new Float32Array(frame.values),
  }));
}

export function createAudioAnalysisProviderFromRenderSession(
  session: RenderSession,
): AudioAnalysisProvider | null {
  const snapshot = session.assets.audioAnalysis?.snapshot;

  if (!snapshot) {
    return null;
  }

  const analysisSnapshot: AudioAnalysisSnapshot = {
    createdAt: snapshot.createdAt,
    fps: snapshot.fps,
    waveform: toWaveformOverview(snapshot),
    bassSpectrumFrames: toSpectrumFrames(snapshot.bassSpectrumFrames),
    wideSpectrumFrames: toSpectrumFrames(snapshot.wideSpectrumFrames),
    magnitudes: snapshot.magnitudes,
  };

  return createArrayAudioAnalysisProvider(analysisSnapshot);
}

function createResolvedAssetLookup(session: RenderSession) {
  const resolvedAssetUrls = new Map<string, string>();

  for (const binding of session.assets.bindings) {
    if (!binding.resolvedUrl) {
      continue;
    }

    resolvedAssetUrls.set(binding.assetId, binding.resolvedUrl);
  }

  for (const font of session.assets.fonts) {
    if (!font.assetId || !font.resolvedUrl) {
      continue;
    }

    resolvedAssetUrls.set(font.assetId, font.resolvedUrl);
  }

  return resolvedAssetUrls;
}

export function createAssetResolverFromRenderSession(
  session: RenderSession,
): RenderAssetResolver {
  const resolvedAssetUrls = createResolvedAssetLookup(session);

  const resolveUrl = async (assetId: string): Promise<string> => {
    const resolvedUrl = resolvedAssetUrls.get(assetId);

    if (!resolvedUrl) {
      throw new Error(`Render session asset ${assetId} is not resolved.`);
    }

    return resolvedUrl;
  };

  return createCachedBrowserAssetResolver({
    resolveImage: resolveUrl,
    resolveVideo: resolveUrl,
    resolveAudio: resolveUrl,
    async resolveFont(fontId) {
      return resolvedAssetUrls.get(fontId) ?? null;
    },
  });
}

function toFontFaceDescriptors(font: RenderSessionFontManifestItem): FontFaceDescriptors {
  const descriptors: FontFaceDescriptors = {};

  if (font.style) {
    descriptors.style = font.style;
  }

  if (font.weight !== null && font.weight !== undefined) {
    descriptors.weight = String(font.weight);
  }

  return descriptors;
}

async function loadFontIntoDocument(font: RenderSessionFontManifestItem): Promise<void> {
  if (!font.resolvedUrl || typeof FontFace === "undefined") {
    return;
  }

  const fontFace = new FontFace(
    font.family,
    `url("${font.resolvedUrl}")`,
    toFontFaceDescriptors(font),
  );

  await fontFace.load();
  document.fonts.add(fontFace);
}

export async function preloadRenderSessionFonts(session: RenderSession): Promise<void> {
  await Promise.all(session.assets.fonts.map((font) => loadFontIntoDocument(font)));

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}
