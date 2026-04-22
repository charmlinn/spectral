import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { createParticleStore, drawParticlesLayer } from "../../adapters/canvas-particles";
import { CanvasSpriteLayer } from "./canvas-sprite-layer";

type ParticleLayer = Extract<RenderLayer, { kind: "particles" }>;

export class PixiParticlesLayer {
  private readonly spriteLayer = new CanvasSpriteLayer(15);
  private readonly particleStore = createParticleStore();

  get container() {
    return this.spriteLayer.container;
  }

  render(layer: ParticleLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.spriteLayer.resize(input);
    this.container.visible = Boolean(layer);

    const context = this.spriteLayer.clear();

    if (layer) {
      drawParticlesLayer(context, layer, input, this.particleStore);
    }

    this.spriteLayer.renderComplete();
  }

  destroy() {
    this.spriteLayer.destroy();
  }
}

