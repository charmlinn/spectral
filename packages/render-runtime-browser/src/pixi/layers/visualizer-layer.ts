import type { RenderAssetResolver, RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { FlatWaveRenderer } from "../visualizers/flat-wave";
import { WaveCircleRenderer } from "../visualizers/wave-circle";

type VisualizerLayer = Extract<RenderLayer, { kind: "visualizer" }>;

type VisualizerRenderer = FlatWaveRenderer | WaveCircleRenderer;

export class PixiVisualizerLayer {
  private renderer: VisualizerRenderer;
  private rendererShape: "circle" | "flat";
  private lastPlaying = false;
  private lastSurfaceKey = "";

  constructor(
    private readonly assetResolver: RenderAssetResolver | null | undefined,
  ) {
    this.renderer = new WaveCircleRenderer(assetResolver);
    this.rendererShape = "circle";
  }

  get container() {
    return this.renderer.container;
  }

  private replaceRenderer(shape: "circle" | "flat") {
    const currentContainer = this.renderer.container;
    const parent = currentContainer.parent;
    const index = parent ? parent.getChildIndex(currentContainer) : -1;

    this.renderer.destroy();
    this.renderer =
      shape === "flat"
        ? new FlatWaveRenderer()
        : new WaveCircleRenderer(this.assetResolver);
    this.rendererShape = shape;

    if (parent && index >= 0) {
      parent.addChildAt(this.renderer.container, index);
    }
  }

  private ensureRenderer(layer: VisualizerLayer | null) {
    const shape = layer
      ? layer.props.config.shape === "flat"
        ? "flat"
        : "circle"
      : this.rendererShape;

    if (this.rendererShape === shape) {
      return;
    }

    this.replaceRenderer(shape);
  }

  async render(layer: VisualizerLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.ensureRenderer(layer);
    const surfaceKey = `${input.surface.width}x${input.surface.height}`;

    if (this.lastSurfaceKey && this.lastSurfaceKey !== surfaceKey) {
      this.replaceRenderer(this.rendererShape);
    }

    this.lastSurfaceKey = surfaceKey;

    if (this.lastPlaying !== input.playing && this.rendererShape === "circle") {
      this.renderer.resetSpinPosition();
    }

    this.lastPlaying = input.playing;
    this.renderer.container.visible = Boolean(layer);

    if (!layer) {
      return;
    }

    await this.renderer.render(layer, input);
  }

  destroy() {
    this.renderer.destroy();
  }
}
