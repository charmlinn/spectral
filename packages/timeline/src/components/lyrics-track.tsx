import React from "react";

import { useTimelineSnapping } from "../hooks/use-timeline-snapping";
import { getTimelineWidth } from "../lib/time";
import type { LyricsTrackProps } from "../types";
import { LyricsSegmentBlock } from "./lyrics-segment-block";

export function LyricsTrack({
  durationMs,
  pxPerSecond,
  segments,
  selectedSegmentIds = [],
  snapPointsMs = [],
  snapThresholdMs = 80,
  onSegmentSelect,
  onSegmentChange,
}: LyricsTrackProps) {
  const width = getTimelineWidth(durationMs, pxPerSecond);
  const snapTimeMs = useTimelineSnapping(snapPointsMs, snapThresholdMs);

  return (
    <div
      style={{
        position: "relative",
        width,
        height: 64,
        background: "#181a20",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {segments.map((segment) => (
        <LyricsSegmentBlock
          key={segment.id}
          durationMs={durationMs}
          pxPerSecond={pxPerSecond}
          segment={segment}
          selected={selectedSegmentIds.includes(segment.id)}
          snapTimeMs={snapTimeMs}
          onSelect={onSegmentSelect}
          onChange={onSegmentChange}
        />
      ))}
    </div>
  );
}
