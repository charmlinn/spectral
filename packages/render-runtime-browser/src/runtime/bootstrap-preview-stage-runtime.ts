import { createHtmlMediaElementClock } from "../clock/html-media-clock";
import type { BrowserRenderRuntime, PreviewStageRuntimeOptions } from "../contracts/runtime";
import { createSpectralPixiRenderAdapter } from "../pixi/spectral-pixi-render-adapter";
import { createBrowserRenderRuntime } from "./browser-render-runtime";

const SPECTERR_PREVIEW_FRAME_CONTEXT_FPS = 60;

export async function bootstrapPreviewStageRuntime(
  options: PreviewStageRuntimeOptions,
): Promise<BrowserRenderRuntime> {
  const runtime = createBrowserRenderRuntime({
    adapter:
      options.adapter ??
      createSpectralPixiRenderAdapter({
        assetResolver: options.assetResolver,
    }),
    project: options.project,
    surface: options.surface,
    clock: createHtmlMediaElementClock(
      options.audioElement,
      SPECTERR_PREVIEW_FRAME_CONTEXT_FPS,
    ),
    frameContextFps: SPECTERR_PREVIEW_FRAME_CONTEXT_FPS,
    analysisProvider: options.analysisProvider,
    assetResolver: options.assetResolver ?? null,
    autoStart: options.autoStart,
  });

  await runtime.mount(options.target);

  return runtime;
}
