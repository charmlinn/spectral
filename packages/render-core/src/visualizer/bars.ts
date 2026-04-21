import type { RenderSurface, VisualizerBar } from "../contracts/render";

export type CreateVisualizerBarsInput = {
  spectrum: Float32Array;
  surface: RenderSurface;
  maxBars: number;
  baselineHeightRatio?: number;
};

export function createVisualizerBars(input: CreateVisualizerBarsInput): VisualizerBar[] {
  const barCount = Math.max(1, Math.min(input.maxBars, input.spectrum.length));
  const barWidth = input.surface.width / barCount;
  const baselineHeightRatio = input.baselineHeightRatio ?? 0.34;
  const bars: VisualizerBar[] = [];

  for (let index = 0; index < barCount; index += 1) {
    const rawValue = input.spectrum[index] ?? 0;
    const normalizedValue = Math.min(1, Math.max(0, rawValue / 255));
    const height = normalizedValue * input.surface.height * baselineHeightRatio;

    bars.push({
      index,
      x: index * barWidth,
      y: input.surface.height - height,
      width: Math.max(1, barWidth - 2),
      height,
      value: rawValue,
    });
  }

  return bars;
}
