import { createManualRenderClock } from "../clock/manual-render-clock";
import type { BrowserRenderRuntime, RenderPageRuntimeOptions } from "../contracts/runtime";
import { createSpectralPixiRenderAdapter } from "../pixi/spectral-pixi-render-adapter";
import { createBrowserRenderRuntime } from "./browser-render-runtime";

export async function bootstrapRenderPageRuntime(
  options: RenderPageRuntimeOptions,
): Promise<BrowserRenderRuntime> {
  const fps = options.fps ?? options.project.timing.fps;

  const runtime = createBrowserRenderRuntime({
    adapter:
      options.adapter ??
      createSpectralPixiRenderAdapter({
        assetResolver: options.assetResolver,
      }),
    project: options.project,
    surface: options.surface,
    clock: options.clock ?? createManualRenderClock({ fps }),
    frameContextFps: fps,
    frameContextDurationMs: options.durationMs ?? options.project.timing.durationMs,
    analysisProvider: options.analysisProvider,
    assetResolver: options.assetResolver ?? null,
    autoStart: options.autoStart,
  });

  await runtime.mount(options.target);

  return runtime;
}
