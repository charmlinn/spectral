import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { PixiLyricsContainer } from "../text/lyrics-container";

type LyricsLayer = Extract<RenderLayer, { kind: "lyrics" }>;

export class PixiLyricsLayer {
  private readonly lyricsContainer = new PixiLyricsContainer(30);

  get container() {
    return this.lyricsContainer.container;
  }

  render(layer: LyricsLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.lyricsContainer.render(layer, input);
  }

  destroy() {
    this.lyricsContainer.destroy();
  }
}
