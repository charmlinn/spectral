import { createFrameContext, timeMsToFrame, type RenderClock } from "@spectral/render-core";

export type ManualRenderClockOptions = {
  fps: number;
};

export function createManualRenderClock(options: ManualRenderClockOptions): RenderClock {
  let currentTimeMs = 0;

  return {
    getCurrentTimeMs() {
      return currentTimeMs;
    },
    getCurrentFrame() {
      return timeMsToFrame(currentTimeMs, options.fps);
    },
    seekToMs(ms: number) {
      currentTimeMs = Math.max(0, ms);
    },
  };
}

export function createFrameContextFromClock(
  clock: RenderClock,
  fps: number,
  durationMs: number,
) {
  return createFrameContext(clock.getCurrentTimeMs(), fps, durationMs);
}
