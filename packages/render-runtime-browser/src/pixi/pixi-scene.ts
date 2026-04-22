import { Container, type Application } from "pixi.js";
import type { RenderAssetResolver, RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../contracts/runtime";
import { PixiBackdropLayer } from "./layers/backdrop-layer";
import { PixiLyricsLayer } from "./layers/lyrics-layer";
import { PixiParticlesLayer } from "./layers/particles-layer";
import { PixiTextLayer } from "./layers/text-layer";
import { PixiVisualizerLayer } from "./layers/visualizer-layer";

type LayerMap = {
  backdrop: Extract<RenderLayer, { kind: "backdrop" }> | null;
  lyrics: Extract<RenderLayer, { kind: "lyrics" }> | null;
  particles: Extract<RenderLayer, { kind: "particles" }> | null;
  text: Extract<RenderLayer, { kind: "text" }>[];
  visualizer: Extract<RenderLayer, { kind: "visualizer" }> | null;
};

function collectLayers(layers: RenderLayer[]): LayerMap {
  return {
    backdrop:
      (layers.find((layer) => layer.kind === "backdrop") as LayerMap["backdrop"]) ??
      null,
    lyrics:
      (layers.find((layer) => layer.kind === "lyrics") as LayerMap["lyrics"]) ??
      null,
    particles:
      (layers.find((layer) => layer.kind === "particles") as LayerMap["particles"]) ??
      null,
    text: layers.filter(
      (layer): layer is Extract<RenderLayer, { kind: "text" }> =>
        layer.kind === "text",
    ),
    visualizer:
      (layers.find((layer) => layer.kind === "visualizer") as LayerMap["visualizer"]) ??
      null,
  };
}

export class PixiSceneRenderer {
  readonly root = new Container();
  readonly backdropLayer: PixiBackdropLayer;
  readonly visualizerLayer: PixiVisualizerLayer;
  readonly particlesLayer = new PixiParticlesLayer();
  readonly lyricsLayer = new PixiLyricsLayer();
  readonly textLayer = new PixiTextLayer();

  constructor(
    app: Application,
    assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.backdropLayer = new PixiBackdropLayer(assetResolver);
    this.visualizerLayer = new PixiVisualizerLayer(assetResolver);
    this.root.sortableChildren = true;
    this.root.addChild(this.backdropLayer.container);
    this.root.addChild(this.visualizerLayer.container);
    this.root.addChild(this.particlesLayer.container);
    this.root.addChild(this.lyricsLayer.container);
    this.root.addChild(this.textLayer.container);
    app.stage.addChild(this.root);
  }

  async render(input: BrowserRenderAdapterRenderInput) {
    const grouped = collectLayers(input.visibleLayers);

    await this.backdropLayer.render(grouped.backdrop, input);
    await this.visualizerLayer.render(grouped.visualizer, input);
    this.particlesLayer.render(grouped.particles, input);
    this.lyricsLayer.render(grouped.lyrics, input);
    this.textLayer.render(grouped.text, input);
  }

  destroy() {
    this.backdropLayer.destroy();
    this.visualizerLayer.destroy();
    this.particlesLayer.destroy();
    this.lyricsLayer.destroy();
    this.textLayer.destroy();
    this.root.destroy({ children: true });
  }
}

