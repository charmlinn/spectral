import { createCanvas2dRenderAdapter } from "../adapters/canvas-2d-render-adapter";
import { createManualRenderClock } from "../clock/manual-render-clock";
import type { BrowserRenderRuntime, RenderPageRuntimeOptions } from "../contracts/runtime";
import { createBrowserRenderRuntime } from "./browser-render-runtime";

export async function bootstrapRenderPageRuntime(
  options: RenderPageRuntimeOptions,
): Promise<BrowserRenderRuntime> {
  const runtime = createBrowserRenderRuntime({
    adapter:
      options.adapter ??
      createCanvas2dRenderAdapter({
        assetResolver: options.assetResolver,
      }),
    project: options.project,
    surface: options.surface,
    clock: options.clock ?? createManualRenderClock({ fps: options.project.timing.fps }),
    analysisProvider: options.analysisProvider,
    assetResolver: options.assetResolver ?? null,
    autoStart: options.autoStart,
  });

  await runtime.mount(options.target);

  return runtime;
}
