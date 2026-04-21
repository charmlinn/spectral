import React from "react";

import type { TimelinePlayheadProps } from "../types";
import { msToPixels } from "../lib/time";

export function TimelinePlayhead({
  currentTimeMs,
  pxPerSecond,
  scrollLeft,
}: TimelinePlayheadProps) {
  const x = msToPixels(currentTimeMs, pxPerSecond) - scrollLeft;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        transform: `translateX(${x}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 2,
          height: "100%",
          background: "#f97316",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
        }}
      />
      <div
        style={{
          width: 12,
          height: 12,
          marginLeft: -5,
          borderRadius: 999,
          background: "#f97316",
        }}
      />
    </div>
  );
}
