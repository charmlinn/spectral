import { useCallback } from "react";

import { findNearestSnapTime } from "../lib/snapping";

export function useTimelineSnapping(snapPointsMs: number[], thresholdMs: number) {
  return useCallback(
    (targetMs: number) => findNearestSnapTime(targetMs, snapPointsMs, thresholdMs),
    [snapPointsMs, thresholdMs],
  );
}
