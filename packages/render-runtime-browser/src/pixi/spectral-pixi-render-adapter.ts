import { Application } from "pixi.js";
import type { RenderAssetResolver, RenderSurface } from "@spectral/render-core";

import type {
  BrowserRenderAdapter,
  BrowserRenderAdapterMountTarget,
  BrowserRenderAdapterRenderInput,
} from "../contracts/runtime";
import { PixiSceneRenderer } from "./pixi-scene";

type SpectralPixiRenderAdapterOptions = {
  assetResolver?: RenderAssetResolver | null;
};

function isCanvasElement(
  target: BrowserRenderAdapterMountTarget,
): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
}

function applyCanvasStyle(canvas: HTMLCanvasElement) {
  canvas.style.display = "block";
  canvas.style.height = "100%";
  canvas.style.maxHeight = "100%";
  canvas.style.maxWidth = "100%";
  canvas.style.objectFit = "contain";
  canvas.style.width = "100%";
}

export function createSpectralPixiRenderAdapter(
  options: SpectralPixiRenderAdapterOptions = {},
): BrowserRenderAdapter {
  let app: Application | null = null;
  let scene: PixiSceneRenderer | null = null;

  async function initApp(
    target: BrowserRenderAdapterMountTarget,
    surface: RenderSurface,
  ) {
    const nextApp = new Application();

    await nextApp.init({
      antialias: true,
      autoDensity: true,
      autoStart: false,
      backgroundAlpha: 0,
      height: surface.height,
      preference: "webgl",
      resolution: surface.dpr,
      width: surface.width,
    });

    nextApp.stage.sortableChildren = true;
    applyCanvasStyle(nextApp.canvas);

    if (isCanvasElement(target)) {
      const parent = target.parentElement;

      target.replaceWith(nextApp.canvas);

      if (!parent) {
        throw new Error("Pixi adapter target canvas has no parent element.");
      }
    } else {
      target.replaceChildren(nextApp.canvas);
    }

    app = nextApp;
    scene = new PixiSceneRenderer(nextApp, options.assetResolver);
  }

  return {
    async mount(target, surface) {
      await initApp(target, surface);
    },
    async resize(surface) {
      if (!app) {
        return;
      }

      app.renderer.resize(surface.width, surface.height);
    },
    async render(input: BrowserRenderAdapterRenderInput) {
      if (!app || !scene) {
        throw new Error("Pixi render adapter used before mount.");
      }

      await scene.render(input);
      app.render();
    },
    destroy() {
      scene?.destroy();
      scene = null;
      app?.destroy({ removeView: true }, true);
      app = null;
    },
  };
}
