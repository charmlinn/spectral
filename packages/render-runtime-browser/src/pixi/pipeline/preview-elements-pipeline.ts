import type { RenderAssetResolver, RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  chooseBackgroundRenderer,
  chooseLyricsRenderer,
  chooseParticlesRenderer,
  chooseTextRenderer,
  chooseVisualizerRenderer,
} from "../helpers";

type BackdropLayer = Extract<RenderLayer, { kind: "backdrop" }>;
type VisualizerLayer = Extract<RenderLayer, { kind: "visualizer" }>;
type LyricsLayer = Extract<RenderLayer, { kind: "lyrics" }>;
type ParticleLayer = Extract<RenderLayer, { kind: "particles" }>;
type TextLayer = Extract<RenderLayer, { kind: "text" }>;

type GroupedLayers = {
  backdrop: BackdropLayer | null;
  lyrics: LyricsLayer | null;
  particles: ParticleLayer | null;
  text: TextLayer[];
  visualizer: VisualizerLayer | null;
};

function groupLayers(layers: RenderLayer[]): GroupedLayers {
  return {
    backdrop:
      (layers.find((layer) => layer.kind === "backdrop") as BackdropLayer | undefined) ??
      null,
    lyrics:
      (layers.find((layer) => layer.kind === "lyrics") as LyricsLayer | undefined) ??
      null,
    particles:
      (layers.find((layer) => layer.kind === "particles") as ParticleLayer | undefined) ??
      null,
    text: layers.filter(
      (layer): layer is TextLayer => layer.kind === "text",
    ),
    visualizer:
      (layers.find((layer) => layer.kind === "visualizer") as VisualizerLayer | undefined) ??
      null,
  };
}

export class PreviewElementsPipeline {
  readonly renderElements;
  private layers: GroupedLayers = {
    backdrop: null,
    lyrics: null,
    particles: null,
    text: [],
    visualizer: null,
  };

  constructor(assetResolver: RenderAssetResolver | null | undefined) {
    this.renderElements = {
      background: chooseBackgroundRenderer(assetResolver),
      particles: chooseParticlesRenderer(),
      visualizer: chooseVisualizerRenderer(assetResolver),
      text: chooseTextRenderer(),
      lyrics: chooseLyricsRenderer(),
    };
  }

  get containers() {
    return [
      this.renderElements.background.container,
      this.renderElements.visualizer.container,
      this.renderElements.particles.container,
      this.renderElements.lyrics.container,
      this.renderElements.text.container,
    ];
  }

  update(input: BrowserRenderAdapterRenderInput) {
    this.layers = groupLayers(input.visibleLayers);
  }

  async draw(input: BrowserRenderAdapterRenderInput) {
    await this.renderElements.background.render(this.layers.backdrop, input);
    await this.renderElements.visualizer.render(this.layers.visualizer, input);
    this.renderElements.particles.render(this.layers.particles, input);
    this.renderElements.text.render(this.layers.text, input);
    this.renderElements.lyrics.render(this.layers.lyrics, input);
  }

  destroy() {
    this.renderElements.background.destroy();
    this.renderElements.visualizer.destroy();
    this.renderElements.particles.destroy();
    this.renderElements.text.destroy();
    this.renderElements.lyrics.destroy();
  }
}

