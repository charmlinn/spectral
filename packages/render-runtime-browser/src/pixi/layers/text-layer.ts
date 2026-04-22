import { type RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { PixiTextContainer } from "../text/text-container";

type TextLayer = Extract<RenderLayer, { kind: "text" }>;

export class PixiTextLayer {
  private readonly textContainer = new PixiTextContainer(20);

  get container() {
    return this.textContainer.container;
  }

  render(layers: TextLayer[], input: BrowserRenderAdapterRenderInput) {
    this.textContainer.render(layers, input);
  }

  destroy() {
    this.textContainer.destroy();
  }
}
