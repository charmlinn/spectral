import { createHtmlMediaElementClock } from "../clock/html-media-clock";
import type { BrowserRenderRuntime, PreviewStageRuntimeOptions } from "../contracts/runtime";
import { createSpectralRuntimeSession } from "./create-spectral-runtime-session";

const SPECTERR_PREVIEW_FRAME_CONTEXT_FPS = 60;

export async function bootstrapPreviewStageRuntime(
  options: PreviewStageRuntimeOptions,
): Promise<BrowserRenderRuntime> {
  return createSpectralRuntimeSession({
    adapter: options.adapter,
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
    mode: "preview",
    target: options.target,
  });
}
