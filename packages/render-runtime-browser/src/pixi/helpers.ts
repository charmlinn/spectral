import type { RenderAssetResolver } from "@spectral/render-core";

import { PixiBackdropLayer } from "./layers/backdrop-layer";
import { PixiLyricsLayer } from "./layers/lyrics-layer";
import { PixiParticlesLayer } from "./layers/particles-layer";
import { PixiTextLayer } from "./layers/text-layer";
import { PixiVisualizerLayer } from "./layers/visualizer-layer";

export function chooseBackgroundRenderer(
  assetResolver: RenderAssetResolver | null | undefined,
) {
  return new PixiBackdropLayer(assetResolver);
}

export function chooseParticlesRenderer() {
  return new PixiParticlesLayer();
}

export function chooseVisualizerRenderer(
  assetResolver: RenderAssetResolver | null | undefined,
) {
  return new PixiVisualizerLayer(assetResolver);
}

export function chooseTextRenderer() {
  return new PixiTextLayer();
}

export function chooseLyricsRenderer() {
  return new PixiLyricsLayer();
}

