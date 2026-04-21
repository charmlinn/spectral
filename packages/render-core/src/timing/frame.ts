import type { RenderFrameContext } from "../contracts/render";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function timeMsToFrame(timeMs: number, fps: number): number {
  return Math.round((timeMs / 1000) * fps);
}

export function frameToTimeMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

export function clampTimeMs(timeMs: number, durationMs: number): number {
  return clamp(timeMs, 0, Math.max(0, durationMs));
}

export function createFrameContext(
  timeMs: number,
  fps: number,
  durationMs: number,
): RenderFrameContext {
  const clampedTimeMs = clampTimeMs(timeMs, durationMs);
  const frame = timeMsToFrame(clampedTimeMs, fps);

  return {
    timeMs: clampedTimeMs,
    frame,
    fps,
    durationMs,
    progress: durationMs <= 0 ? 0 : clampedTimeMs / durationMs,
  };
}
