import { Container } from "pixi.js";
import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { PixiTextElement } from "./text-element";

type TextLayer = Extract<RenderLayer, { kind: "text" }>;

export class PixiTextContainer {
  readonly container = new Container();
  private readonly textElements = new Map<string, PixiTextElement>();

  constructor(zIndex: number) {
    this.container.zIndex = zIndex;
  }

  render(layers: TextLayer[], input: BrowserRenderAdapterRenderInput) {
    const activeIds = new Set<string>();

    this.container.position.set(input.surface.width / 2, input.surface.height / 2);

    for (const layer of layers) {
      activeIds.add(layer.id);

      let textElement = this.textElements.get(layer.id);

      if (!textElement) {
        textElement = new PixiTextElement();
        this.textElements.set(layer.id, textElement);
        this.container.addChild(textElement.text);
      }

      textElement.update(
        layer.props.layer.visible
          ? PixiTextElement.fromTextLayer(layer.props.layer)
          : null,
        {
          amplitude: layer.props.amplitude,
          surface: input.surface,
          timeMs: input.frameContext.timeMs,
        },
        layer.zIndex,
      );
    }

    for (const [id, textElement] of this.textElements) {
      if (!activeIds.has(id)) {
        textElement.text.visible = false;
      }
    }

    this.container.sortChildren();
  }

  destroy() {
    this.container.destroy({ children: true });
    this.textElements.clear();
  }
}
