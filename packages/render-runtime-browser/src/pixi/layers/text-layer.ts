import { Container, Text, TextStyle as PixiTextStyle } from "pixi.js";
import { computeDriftTransform, type RenderLayer } from "@spectral/render-core";

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

type TextLayer = Extract<RenderLayer, { kind: "text" }>;

export class PixiTextLayer {
  readonly container = new Container();
  private readonly textNodes = new Map<string, Text>();

  constructor() {
    this.container.zIndex = 30;
  }

  render(layers: TextLayer[], input: BrowserRenderAdapterRenderInput) {
    const activeIds = new Set<string>();
    const multiplier = getSurfaceMultiplier(input.surface);

    for (const layer of layers) {
      if (!layer.props.layer.visible) {
        continue;
      }

      activeIds.add(layer.id);
      const style = layer.props.layer.style;
      const fontSize = Math.max(1, style.fontSize * multiplier);
      const drift = computeDriftTransform({
        drift: style.drift,
        kind: "text",
        timeMs: input.frameContext.timeMs,
        spectrumMagnitude: layer.props.amplitude,
        width: input.surface.width * 0.8,
        height: input.surface.height * 0.2,
      });
      let textNode = this.textNodes.get(layer.id);

      if (!textNode) {
        textNode = new Text({
          text: "",
        });
        this.textNodes.set(layer.id, textNode);
        this.container.addChild(textNode);
      }

      primeFont(style, multiplier);
      textNode.visible = true;
      textNode.text = style.text;
      textNode.zIndex = layer.zIndex;
      textNode.anchor.set(getTextAnchor(style.anchorPoint), 0.5);
      textNode.style = new PixiTextStyle({
        align: getTextAlign(style.anchorPoint),
        dropShadow: getTextDropShadow(style, multiplier),
        fill: toPixiColor(style.color),
        fontFamily: getFontFamilyChain(style.font),
        fontSize: fontSize * 2,
        fontWeight: style.bold ? "700" : "400",
        padding: fontSize / 3,
      });
      textNode.position.set(
        input.surface.width / 2 +
          style.position.x * multiplier +
          (drift?.translateX ?? 0),
        input.surface.height / 2 +
          style.position.y * multiplier +
          (drift?.translateY ?? 0),
      );
      textNode.rotation = drift?.rotationRad ?? 0;
      textNode.scale.set(0.5 * (drift?.scale ?? 1));
    }

    for (const [id, textNode] of this.textNodes) {
      if (!activeIds.has(id)) {
        textNode.visible = false;
      }
    }

    this.container.sortChildren();
  }

  destroy() {
    this.container.destroy({ children: true });
    this.textNodes.clear();
  }
}

