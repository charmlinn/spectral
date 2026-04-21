import { useCallback, useRef } from "react";

import { clamp, pixelsToMs } from "../lib/time";

export type UseTimelinePlayheadOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  durationMs: number;
  pxPerSecond: number;
  scrollLeft: number;
  onSeek?(timeMs: number): void;
};

export function useTimelinePlayhead(options: UseTimelinePlayheadOptions) {
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef(0);

  return useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const container = options.containerRef.current;

      if (!container || !options.onSeek) {
        return;
      }

      const updateTime = (clientX: number) => {
        const rect = container.getBoundingClientRect();
        const localX = clientX - rect.left + options.scrollLeft;
        lastMsRef.current = clamp(
          pixelsToMs(localX, options.pxPerSecond),
          0,
          options.durationMs,
        );

        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            options.onSeek?.(lastMsRef.current);
            rafRef.current = null;
          });
        }
      };

      updateTime(event.clientX);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });

      function handlePointerMove(moveEvent: PointerEvent) {
        updateTime(moveEvent.clientX);
      }

      function handlePointerUp() {
        window.removeEventListener("pointermove", handlePointerMove);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        options.onSeek?.(lastMsRef.current);
      }
    },
    [options],
  );
}
