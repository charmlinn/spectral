import React, { useRef } from "react";

import type { TimelineLyricsSegment } from "../types";
import { clamp, msToPixels, pixelsToMs } from "../lib/time";

type LyricsSegmentBlockProps = {
  durationMs: number;
  pxPerSecond: number;
  segment: TimelineLyricsSegment;
  selected: boolean;
  snapTimeMs(targetMs: number): number;
  onSelect?(segmentId: string): void;
  onChange?(segment: TimelineLyricsSegment): void;
};

type DragMode = "move" | "resize-start" | "resize-end";

export function LyricsSegmentBlock({
  durationMs,
  pxPerSecond,
  segment,
  selected,
  snapTimeMs,
  onSelect,
  onChange,
}: LyricsSegmentBlockProps) {
  const rafRef = useRef<number | null>(null);

  const left = msToPixels(segment.startMs, pxPerSecond);
  const width = Math.max(12, msToPixels(segment.endMs - segment.startMs, pxPerSecond));

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(segment.id);

    const startX = event.clientX;
    const originalStartMs = segment.startMs;
    const originalEndMs = segment.endMs;
    let pendingSegment = segment;

    const emitChange = () => {
      onChange?.(pendingSegment);
      rafRef.current = null;
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaMs = pixelsToMs(moveEvent.clientX - startX, pxPerSecond);

      if (mode === "move") {
        const snappedStartMs = snapTimeMs(
          clamp(originalStartMs + deltaMs, 0, durationMs - (originalEndMs - originalStartMs)),
        );
        pendingSegment = {
          ...segment,
          startMs: snappedStartMs,
          endMs: snappedStartMs + (originalEndMs - originalStartMs),
        };
      } else if (mode === "resize-start") {
        const snappedStartMs = snapTimeMs(
          clamp(originalStartMs + deltaMs, 0, originalEndMs - 50),
        );
        pendingSegment = {
          ...segment,
          startMs: snappedStartMs,
        };
      } else {
        const snappedEndMs = snapTimeMs(
          clamp(originalEndMs + deltaMs, originalStartMs + 50, durationMs),
        );
        pendingSegment = {
          ...segment,
          endMs: snappedEndMs,
        };
      }

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(emitChange);
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      onChange?.(pendingSegment);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(event) => startDrag(event, "move")}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(segment.id);
      }}
      style={{
        position: "absolute",
        left,
        top: 10,
        width,
        height: 44,
        borderRadius: 10,
        background: selected ? "#f97316" : "#272a33",
        color: "#fafafa",
        boxShadow: selected
          ? "0 0 0 1px rgba(249,115,22,0.8), 0 8px 20px rgba(0,0,0,0.25)"
          : "0 0 0 1px rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        onPointerDown={(event) => startDrag(event, "resize-start")}
        style={{
          width: 8,
          height: "100%",
          cursor: "ew-resize",
          background: "rgba(255,255,255,0.2)",
        }}
      />
      <div
        style={{
          flex: 1,
          padding: "0 10px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 12,
        }}
      >
        {segment.text}
      </div>
      <div
        onPointerDown={(event) => startDrag(event, "resize-end")}
        style={{
          width: 8,
          height: "100%",
          cursor: "ew-resize",
          background: "rgba(255,255,255,0.2)",
        }}
      />
    </div>
  );
}
