import type { RenderSurface } from "@spectral/render-core";

import type { BrowserRenderRuntime } from "../contracts/runtime";

export type BindRuntimeSurfaceOptions = {
  runtime: BrowserRenderRuntime;
  target: HTMLElement;
  getDpr?(): number;
};

export function createRenderSurfaceFromElement(
  element: HTMLElement,
  getDpr: () => number = () => window.devicePixelRatio || 1,
): RenderSurface {
  const rect = element.getBoundingClientRect();

  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    dpr: Math.max(1, getDpr()),
  };
}

export function bindRuntimeSurfaceToElement(
  options: BindRuntimeSurfaceOptions,
): () => void {
  const observer = new ResizeObserver(() => {
    void options.runtime.setSurface(
      createRenderSurfaceFromElement(options.target, options.getDpr),
    );
  });

  observer.observe(options.target);

  void options.runtime.setSurface(
    createRenderSurfaceFromElement(options.target, options.getDpr),
  );

  return () => {
    observer.disconnect();
  };
}
