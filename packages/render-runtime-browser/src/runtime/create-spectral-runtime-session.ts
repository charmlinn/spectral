import type { RenderClock } from "@spectral/render-core";

import type {
  BrowserRenderAdapter,
  BrowserRenderRuntime,
  BrowserRenderRuntimeOptions,
  BrowserRenderAdapterMountTarget,
} from "../contracts/runtime";
import { createSpectralPixiRenderAdapter } from "../pixi/spectral-pixi-render-adapter";
import { createBrowserRenderRuntime } from "./browser-render-runtime";

export type SpectralRuntimeMode = "preview" | "export";

export type CreateSpectralRuntimeSessionOptions = Omit<
  BrowserRenderRuntimeOptions,
  "adapter" | "autoStart"
> & {
  adapter?: BrowserRenderAdapter;
  autoStart?: boolean;
  mode: SpectralRuntimeMode;
  target: BrowserRenderAdapterMountTarget;
};

export async function createSpectralRuntimeSession(
  options: CreateSpectralRuntimeSessionOptions,
): Promise<BrowserRenderRuntime> {
  const runtime = createBrowserRenderRuntime({
    adapter:
      options.adapter ??
      createSpectralPixiRenderAdapter({
        assetResolver: options.assetResolver,
      }),
    project: options.project,
    surface: options.surface,
    clock: options.clock as RenderClock | null | undefined,
    frameContextFps: options.frameContextFps,
    frameContextDurationMs: options.frameContextDurationMs,
    analysisProvider: options.analysisProvider,
    historyProvider: options.historyProvider,
    assetResolver: options.assetResolver,
    autoStart: options.autoStart,
    onFrame: options.onFrame,
    buildSceneGraph: options.buildSceneGraph,
  });

  await runtime.mount(options.target);

  return runtime;
}
