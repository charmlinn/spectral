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
        zIndex: 3,
      }}
    >
      <div
        style={{
          width: 3,
          height: "100%",
          background:
            "linear-gradient(180deg, #fbbf24 0%, #f97316 55%, #fb7185 100%)",
          boxShadow:
            "0 0 0 1px rgba(15,23,42,0.45), 0 0 22px rgba(249,115,22,0.42), 0 0 48px rgba(249,115,22,0.18)",
        }}
      />
      <div
        style={{
          width: 14,
          height: 14,
          marginLeft: -5.5,
          borderRadius: 999,
          background:
            "radial-gradient(circle at 35% 35%, #fde68a 0%, #f59e0b 45%, #f97316 100%)",
          boxShadow:
            "0 0 0 2px rgba(15,23,42,0.9), 0 6px 18px rgba(249,115,22,0.35)",
        }}
      />
    </div>
  );
}
