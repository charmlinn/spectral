import { createHtmlMediaElementClock } from "../clock/html-media-clock";
import type { BrowserRenderRuntime, PreviewStageRuntimeOptions } from "../contracts/runtime";
import { createCanvas2dRenderAdapter } from "../adapters/canvas-2d-render-adapter";
import { createBrowserRenderRuntime } from "./browser-render-runtime";

export async function bootstrapPreviewStageRuntime(
  options: PreviewStageRuntimeOptions,
): Promise<BrowserRenderRuntime> {
  const runtime = createBrowserRenderRuntime({
    adapter:
      options.adapter ??
      createCanvas2dRenderAdapter({
        assetResolver: options.assetResolver,
      }),
    project: options.project,
    surface: options.surface,
    clock: createHtmlMediaElementClock(options.audioElement, options.project.timing.fps),
    analysisProvider: options.analysisProvider,
    assetResolver: options.assetResolver ?? null,
    autoStart: options.autoStart,
  });

  await runtime.mount(options.target);

  return runtime;
}
