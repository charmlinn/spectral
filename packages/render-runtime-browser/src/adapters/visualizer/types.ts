import type { RenderLayer } from "@spectral/render-core";
import type { VisualizerWaveCircle } from "@spectral/project-schema";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import type { SpecterrWaveCircleRenderOptions } from "../specterr-visualizer-options";

export type VisualizerLayer = Extract<RenderLayer, { kind: "visualizer" }>;
export type VisualizerConfig = VisualizerLayer["props"]["config"];

export type VisualizerRingRenderConfig = {
  barWidth: number;
  inverted: boolean;
  pointRadius: number;
  reflectionType: string;
  rotationRad: number;
  waveType: string;
  waveStyle: string;
};

export type VisualizerShapeRenderInput = {
  baseHeight: number;
  config: VisualizerConfig;
  context: CanvasRenderingContext2D;
  input: BrowserRenderAdapterRenderInput;
  processedSpectrum: number[];
  radius: number;
  renderConfig: VisualizerRingRenderConfig;
  ring: VisualizerWaveCircle;
  waveCircleOption: SpecterrWaveCircleRenderOptions;
  width: number;
};

export type VisualizerTransform = {
  rotation: number;
  scale: number;
  x: number;
  y: number;
};

export type VisualizerBufferStore = {
  composite: HTMLCanvasElement | null;
  glow: HTMLCanvasElement | null;
  main: HTMLCanvasElement | null;
  shakeOffset: {
    x: number;
    y: number;
  };
};
