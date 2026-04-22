import { Container, Sprite, Texture } from "pixi.js";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";

export class CanvasSpriteLayer {
  readonly container = new Container();
  readonly canvas = document.createElement("canvas");
  readonly context = this.canvas.getContext("2d");
  readonly texture = Texture.from(this.canvas, true);
  readonly sprite = new Sprite({ texture: this.texture });

  constructor(zIndex: number) {
    this.container.zIndex = zIndex;
    this.sprite.anchor.set(0, 0);
    this.container.addChild(this.sprite);
  }

  resize(input: BrowserRenderAdapterRenderInput) {
    const nextWidth = Math.max(1, Math.round(input.surface.width));
    const nextHeight = Math.max(1, Math.round(input.surface.height));

    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }

    this.sprite.width = input.surface.width;
    this.sprite.height = input.surface.height;
  }

  clear() {
    if (!this.context) {
      throw new Error("Failed to acquire Pixi canvas layer context.");
    }

    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "source-over";
    this.context.filter = "none";
    this.context.shadowBlur = 0;
    this.context.shadowColor = "transparent";

    return this.context;
  }

  renderComplete() {
    this.texture.source.update();
  }

  destroy() {
    this.container.destroy({ children: true });
    this.texture.destroy(true);
  }
}

