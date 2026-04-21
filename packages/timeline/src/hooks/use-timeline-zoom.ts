import { useCallback } from "react";

export type UseTimelineZoomOptions = {
  pxPerSecond: number;
  minPxPerSecond: number;
  maxPxPerSecond: number;
  onZoomChange?(pxPerSecond: number): void;
};

export function useTimelineZoom(options: UseTimelineZoomOptions) {
  return useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      event.preventDefault();

      const delta = event.deltaY < 0 ? 1.1 : 0.9;
      const next = Math.min(
        options.maxPxPerSecond,
        Math.max(options.minPxPerSecond, options.pxPerSecond * delta),
      );

      options.onZoomChange?.(next);
    },
    [options],
  );
}
