export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function msToPixels(timeMs: number, pxPerSecond: number): number {
  return (timeMs / 1000) * pxPerSecond;
}

export function pixelsToMs(pixels: number, pxPerSecond: number): number {
  return (pixels / pxPerSecond) * 1000;
}

export function getTimelineWidth(durationMs: number, pxPerSecond: number): number {
  return Math.max(1, msToPixels(durationMs, pxPerSecond));
}

export function formatTimelineTime(timeMs: number): string {
  const totalSeconds = Math.max(0, timeMs) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((totalSeconds % 1) * 100);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    centiseconds,
  ).padStart(2, "0")}`;
}

export function getNiceTickStepMs(pxPerSecond: number): number {
  const targetPx = 96;
  const roughStepMs = pixelsToMs(targetPx, pxPerSecond);
  const steps = [100, 250, 500, 1000, 2000, 5000, 10000];

  for (const step of steps) {
    if (step >= roughStepMs) {
      return step;
    }
  }

  return 10000;
}
