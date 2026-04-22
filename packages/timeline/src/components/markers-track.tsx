import React from "react";

import type { TimelineMarker } from "../types";
import { getTimelineWidth, msToPixels } from "../lib/time";

type MarkersTrackProps = {
  durationMs: number;
  pxPerSecond: number;
  markers: TimelineMarker[];
};

export function MarkersTrack({
  durationMs,
  pxPerSecond,
  markers,
}: MarkersTrackProps) {
  const width = getTimelineWidth(durationMs, pxPerSecond);

  return (
    <div
      style={{
        position: "relative",
        width,
        height: 28,
        background:
          "linear-gradient(180deg, rgba(18,20,25,0.98) 0%, rgba(15,17,22,0.98) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {markers.map((marker) => (
        <div
          key={marker.id}
          style={{
            position: "absolute",
            left: msToPixels(marker.timeMs, pxPerSecond),
            top: 0,
            bottom: 0,
            width: 1,
            background: marker.color ?? "#fb7185",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 5,
              left: 4,
              fontSize: 11,
              color: marker.color ?? "#fb7185",
              whiteSpace: "nowrap",
            }}
          >
            {marker.label}
          </span>
        </div>
      ))}
    </div>
  );
}
