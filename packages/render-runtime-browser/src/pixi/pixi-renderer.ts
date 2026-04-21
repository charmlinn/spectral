import type { RenderLayer, RenderSurface } from "@spectral/render-core";

import type {
  BrowserRenderAdapter,
  BrowserRenderAdapterMountTarget,
  BrowserRenderAdapterRenderInput,
} from "../contracts/runtime";

export type PixiApplicationLike = {
  renderer: {
    resize(width: number, height: number): void;
  };
  destroy(removeView?: boolean, options?: { children?: boolean }): void;
};

export type CreatePixiRenderAdapterOptions = {
  createApplication(target: BrowserRenderAdapterMountTarget, surface: RenderSurface): PixiApplicationLike;
  renderScene(
    app: PixiApplicationLike,
    input: BrowserRenderAdapterRenderInput,
  ): void | Promise<void>;
};

export function createPixiRenderAdapter(
  options: CreatePixiRenderAdapterOptions,
): BrowserRenderAdapter {
  let app: PixiApplicationLike | null = null;

  return {
    mount(target, surface) {
      app = options.createApplication(target, surface);
    },
    resize(surface) {
      app?.renderer.resize(surface.width, surface.height);
    },
    async render(input) {
      if (!app) {
        throw new Error("Pixi render adapter used before mount.");
      }

      await options.renderScene(app, input);
    },
    destroy() {
      app?.destroy(true, { children: true });
      app = null;
    },
  };
}

export function groupLayersByKind(layers: RenderLayer[]): Record<RenderLayer["kind"], RenderLayer[]> {
  return {
    backdrop: layers.filter((layer) => layer.kind === "backdrop"),
    visualizer: layers.filter((layer) => layer.kind === "visualizer"),
    lyrics: layers.filter((layer) => layer.kind === "lyrics"),
    text: layers.filter((layer) => layer.kind === "text"),
  };
}
