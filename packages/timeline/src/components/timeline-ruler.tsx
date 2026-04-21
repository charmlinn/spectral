import React from "react";

import type { TimelineRulerProps } from "../types";
import { formatTimelineTime, getNiceTickStepMs, getTimelineWidth, msToPixels } from "../lib/time";

export function TimelineRuler({ durationMs, pxPerSecond }: TimelineRulerProps) {
  const tickStepMs = getNiceTickStepMs(pxPerSecond);
  const width = getTimelineWidth(durationMs, pxPerSecond);
  const ticks = [];

  for (let timeMs = 0; timeMs <= durationMs; timeMs += tickStepMs) {
    ticks.push(timeMs);
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height: 28,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "#17181d",
      }}
    >
      {ticks.map((timeMs) => (
        <div
          key={timeMs}
          style={{
            position: "absolute",
            insetBlock: 0,
            left: msToPixels(timeMs, pxPerSecond),
            width: 1,
            background: "rgba(255,255,255,0.14)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              fontSize: 11,
              color: "#a1a1aa",
              whiteSpace: "nowrap",
            }}
          >
            {formatTimelineTime(timeMs)}
          </span>
        </div>
      ))}
    </div>
  );
}
