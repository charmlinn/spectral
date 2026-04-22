import { Text, TextStyle as PixiTextStyle } from "pixi.js";
import { computeDriftTransform } from "@spectral/render-core";
import type { TextLayer as ProjectTextLayer, TextStyle as ProjectTextStyle } from "@spectral/project-schema";
import type { RenderSurface } from "@spectral/render-core";

import {
  getFontFamilyChain,
  getTextAlign,
  getTextAnchor,
  getTextDropShadow,
  primeFont,
  toPixiColor,
} from "../shared";

type TextConfig = {
  text: string;
  color: string;
  anchorPoint: string;
  font: string;
  fontSize: number;
  bold: boolean;
  shadow: ProjectTextStyle["shadow"];
  position: ProjectTextStyle["position"];
  drift?: ProjectTextStyle["drift"];
};

const BASE_HEIGHT = 500;

export class PixiTextElement {
  readonly text = new Text({ text: "" });

  constructor() {
    this.text.style = new PixiTextStyle({
      align: "left",
      dropShadow: false,
      fill: 0x000000,
      fontFamily: "Arial",
      fontSize: 16,
      fontWeight: "400",
      padding: 0,
    });
  }

  update(
    config: TextConfig | null,
    input: {
      amplitude: number;
      surface: RenderSurface;
      timeMs: number;
    },
    zIndex: number,
  ) {
    if (!config) {
      this.text.visible = false;
      return;
    }

    const multiplier = input.surface.height / BASE_HEIGHT;
    const fontSize = Math.max(1, config.fontSize * multiplier);
    const drift = computeDriftTransform({
      drift: config.drift,
      kind: "text",
      timeMs: input.timeMs,
      spectrumMagnitude: input.amplitude,
      width: input.surface.width * 0.8,
      height: input.surface.height * 0.2,
    });

    primeFont(
      {
        anchorPoint: config.anchorPoint,
        bold: config.bold,
        color: config.color,
        drift: config.drift ?? {
          acceleration: 0,
          amplitudeX: 0,
          amplitudeY: 0,
          customMode: false,
          enabled: false,
          intensity: 0,
          octaves: 1,
          rotation: 0,
          scale: 1,
          speed: 0,
        },
        font: config.font,
        fontSize: config.fontSize,
        position: config.position,
        shadow: config.shadow,
        text: config.text,
      },
      multiplier,
    );

    this.text.visible = true;
    this.text.zIndex = zIndex;
    this.text.text = config.text;
    this.text.anchor.set(getTextAnchor(config.anchorPoint), 0.5);
    this.text.style = new PixiTextStyle({
      align: getTextAlign(config.anchorPoint),
      dropShadow: getTextDropShadow(
        {
          anchorPoint: config.anchorPoint,
          bold: config.bold,
          color: config.color,
          drift: config.drift ?? {
            acceleration: 0,
            amplitudeX: 0,
            amplitudeY: 0,
            customMode: false,
            enabled: false,
            intensity: 0,
            octaves: 1,
            rotation: 0,
            scale: 1,
            speed: 0,
          },
          font: config.font,
          fontSize: config.fontSize,
          position: config.position,
          shadow: config.shadow,
          text: config.text,
        },
        multiplier,
      ),
      fill: toPixiColor(config.color),
      fontFamily: getFontFamilyChain(config.font),
      fontSize: fontSize * 2,
      fontWeight: config.bold ? "700" : "400",
      padding: fontSize / 3,
    });
    this.text.position.set(
      config.position.x * multiplier + (drift?.translateX ?? 0),
      config.position.y * multiplier + (drift?.translateY ?? 0),
    );
    this.text.rotation = drift?.rotationRad ?? 0;
    this.text.scale.set(0.5 * (drift?.scale ?? 1));
  }

  static fromTextLayer(layer: ProjectTextLayer) {
    return {
      anchorPoint: layer.style.anchorPoint,
      bold: layer.style.bold,
      color: layer.style.color,
      drift: layer.style.drift,
      font: layer.style.font,
      fontSize: layer.style.fontSize,
      position: layer.style.position,
      shadow: layer.style.shadow,
      text: layer.style.text,
    } satisfies TextConfig;
  }
}
