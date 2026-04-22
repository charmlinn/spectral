import { Container, type Application } from "pixi.js";
import type { RenderAssetResolver } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../contracts/runtime";
import { PreviewElementsPipeline } from "./pipeline/preview-elements-pipeline";

export class PixiSceneRenderer {
  readonly root = new Container();
  readonly pipeline: PreviewElementsPipeline;

  constructor(
    app: Application,
    assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.pipeline = new PreviewElementsPipeline(assetResolver);
    this.root.sortableChildren = true;
    this.root.addChild(...this.pipeline.containers);
    app.stage.addChild(this.root);
  }

  async render(input: BrowserRenderAdapterRenderInput) {
    this.pipeline.update(input);
    this.root.sortChildren();
    await this.pipeline.draw(input);
    this.root.sortChildren();
  }

  destroy() {
    this.pipeline.destroy();
    this.root.destroy({ children: true });
  }
}
