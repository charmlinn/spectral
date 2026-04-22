import { Container } from "pixi.js";
import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { PixiTextElement } from "./text-element";

type LyricsLayer = Extract<RenderLayer, { kind: "lyrics" }>;

export class PixiLyricsContainer {
  readonly container = new Container();
  private readonly textElement = new PixiTextElement();

  constructor(zIndex: number) {
    this.container.zIndex = zIndex;
    this.container.addChild(this.textElement.text);
  }

  render(layer: LyricsLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.container.position.set(input.surface.width / 2, input.surface.height / 2);

    if (!layer?.props.activeSegment) {
      this.textElement.update(
        null,
        {
          amplitude: 0,
          surface: input.surface,
          timeMs: input.frameContext.timeMs,
        },
        0,
      );
      return;
    }

    this.textElement.update(
      {
        anchorPoint: layer.props.style.anchorPoint,
        bold: layer.props.style.bold,
        color: layer.props.style.color,
        font: layer.props.style.font,
        fontSize: layer.props.style.fontSize,
        position: layer.props.style.position,
        shadow: layer.props.style.shadow,
        text: layer.props.activeSegment.text,
      },
      {
        amplitude: 0,
        surface: input.surface,
        timeMs: input.frameContext.timeMs,
      },
      layer.zIndex,
    );
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
