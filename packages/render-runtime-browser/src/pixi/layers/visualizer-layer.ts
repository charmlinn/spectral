import type { RenderAssetResolver } from "@spectral/render-core";
import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { createMediaCache } from "../../adapters/canvas-media";
import { createVisualizerBufferStore, drawVisualizerLayer } from "../../adapters/visualizer/render";
import { CanvasSpriteLayer } from "./canvas-sprite-layer";

type VisualizerLayer = Extract<RenderLayer, { kind: "visualizer" }>;

export class PixiVisualizerLayer {
  private readonly spriteLayer = new CanvasSpriteLayer(10);
  private readonly mediaCache = createMediaCache();
  private readonly buffers = createVisualizerBufferStore();

  constructor(
    private readonly assetResolver: RenderAssetResolver | null | undefined,
  ) {}

  get container() {
    return this.spriteLayer.container;
  }

  async render(layer: VisualizerLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.spriteLayer.resize(input);
    this.container.visible = Boolean(layer);

    if (!layer) {
      this.spriteLayer.clear();
      this.spriteLayer.renderComplete();
      return;
    }

    const context = this.spriteLayer.clear();

    await drawVisualizerLayer(
      context,
      layer,
      input,
      this.mediaCache,
      this.buffers,
      this.assetResolver,
    );

    this.spriteLayer.renderComplete();
  }

  destroy() {
    this.spriteLayer.destroy();
  }
}

