import { Container, Text, TextStyle as PixiTextStyle } from "pixi.js";
import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  getFontFamilyChain,
  getSurfaceMultiplier,
  getTextAlign,
  getTextAnchor,
  getTextDropShadow,
  primeFont,
  toPixiColor,
} from "../shared";

type LyricsLayer = Extract<RenderLayer, { kind: "lyrics" }>;

export class PixiLyricsLayer {
  readonly container = new Container();
  private readonly textNode = new Text({ text: "" });

  constructor() {
    this.container.zIndex = 20;
    this.container.addChild(this.textNode);
  }

  render(layer: LyricsLayer | null, input: BrowserRenderAdapterRenderInput) {
    if (!layer?.props.activeSegment) {
      this.textNode.visible = false;
      this.textNode.text = "";
      return;
    }

    const style = layer.props.style;
    const multiplier = getSurfaceMultiplier(input.surface);
    const fontSize = Math.max(1, style.fontSize * multiplier);

    primeFont(style, multiplier);
    this.textNode.visible = true;
    this.textNode.text = layer.props.activeSegment.text;
    this.textNode.anchor.set(getTextAnchor(style.anchorPoint), 0.5);
    this.textNode.style = new PixiTextStyle({
      align: getTextAlign(style.anchorPoint),
      dropShadow: getTextDropShadow(style, multiplier),
      fill: toPixiColor(style.color),
      fontFamily: getFontFamilyChain(style.font),
      fontSize: fontSize * 2,
      fontWeight: style.bold ? "700" : "400",
      padding: fontSize / 3,
    });
    this.textNode.position.set(
      input.surface.width / 2 + style.position.x * multiplier,
      input.surface.height / 2 + style.position.y * multiplier,
    );
    this.textNode.rotation = 0;
    this.textNode.scale.set(0.5);
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
