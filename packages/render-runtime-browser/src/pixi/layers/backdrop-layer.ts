import type { RenderAssetResolver, RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { ReactiveImage } from "../media/reactive-image";
import { ReactiveVideo } from "../media/reactive-video";

type BackdropLayer = Extract<RenderLayer, { kind: "backdrop" }>;

function getSourceKind(layer: BackdropLayer | null) {
  return layer?.props.source?.kind ?? "image";
}

export class PixiBackdropLayer {
  private renderer: ReactiveImage | ReactiveVideo;
  private rendererKind: "image" | "video";

  constructor(
    private readonly assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.renderer = new ReactiveImage(assetResolver);
    this.rendererKind = "image";
  }

  get container() {
    return this.renderer.container;
  }

  private ensureRenderer(layer: BackdropLayer | null) {
    const sourceKind = getSourceKind(layer) === "video" ? "video" : "image";

    if (this.rendererKind === sourceKind) {
      return;
    }

    const currentContainer = this.renderer.container;
    const parent = currentContainer.parent;
    const index = parent ? parent.getChildIndex(currentContainer) : -1;

    this.renderer.destroy();
    this.renderer =
      sourceKind === "video"
        ? new ReactiveVideo(this.assetResolver)
        : new ReactiveImage(this.assetResolver);
    this.rendererKind = sourceKind;

    if (parent && index >= 0) {
      parent.addChildAt(this.renderer.container, index);
    }
  }

  async render(layer: BackdropLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.ensureRenderer(layer);
    await this.renderer.render(layer, input);
  }

  destroy() {
    this.renderer.destroy();
  }
}
