import { createManualRenderClock } from "../clock/manual-render-clock";
import type { BrowserRenderRuntime, RenderPageRuntimeOptions } from "../contracts/runtime";
import { createSpectralRuntimeSession } from "./create-spectral-runtime-session";

export async function bootstrapRenderPageRuntime(
  options: RenderPageRuntimeOptions,
): Promise<BrowserRenderRuntime> {
  const fps = options.fps ?? options.project.timing.fps;

  return createSpectralRuntimeSession({
    adapter: options.adapter,
    project: options.project,
    surface: options.surface,
    clock: options.clock ?? createManualRenderClock({ fps }),
    frameContextFps: fps,
    frameContextDurationMs: options.durationMs ?? options.project.timing.durationMs,
    analysisProvider: options.analysisProvider,
    assetResolver: options.assetResolver ?? null,
    autoStart: options.autoStart,
    mode: "export",
    target: options.target,
  });
}
