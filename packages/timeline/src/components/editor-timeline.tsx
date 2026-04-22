import React, { useEffect, useMemo, useRef } from "react";

import { useTimelinePlayhead } from "../hooks/use-timeline-playhead";
import { useTimelineScroll } from "../hooks/use-timeline-scroll";
import { useTimelineZoom } from "../hooks/use-timeline-zoom";
import {
  duplicateTimelineSegment,
  removeTimelineSegment,
  replaceTimelineSegment,
  splitTimelineSegment,
} from "../lib/segment-operations";
import { getTimelineWidth } from "../lib/time";
import type { EditorTimelineProps } from "../types";
import { AudioWaveformTrack } from "./audio-waveform-track";
import { LyricsTrack } from "./lyrics-track";
import { MarkersTrack } from "./markers-track";
import { TimelineControls } from "./timeline-controls";
import { TimelineGrid } from "./timeline-grid";
import { TimelinePlayhead } from "./timeline-playhead";
import { TimelineRuler } from "./timeline-ruler";

export function EditorTimeline({
  durationMs,
  currentTimeMs,
  pxPerSecond,
  scrollLeft = 0,
  viewportWidth = "100%",
  waveform,
  segments,
  markers = [],
  selection,
  minPxPerSecond = 40,
  maxPxPerSecond = 400,
  snapPointsMs = [],
  snapThresholdMs = 80,
  onSeek,
  onZoomChange,
  onScrollChange,
  onSegmentSelect,
  onSegmentChange,
  onSelectionChange,
  onSegmentsChange,
}: EditorTimelineProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const timelineWidth = useMemo(
    () => getTimelineWidth(durationMs, pxPerSecond),
    [durationMs, pxPerSecond],
  );
  const selectedSegment = useMemo(
    () =>
      segments.find((segment) =>
        selection?.selectedSegmentIds.includes(segment.id),
      ) ?? null,
    [segments, selection?.selectedSegmentIds],
  );
  const handleWheelZoom = useTimelineZoom({
    pxPerSecond,
    minPxPerSecond,
    maxPxPerSecond,
    onZoomChange,
  });
  const handlePlayheadPointerDown = useTimelinePlayhead({
    containerRef: viewportRef,
    durationMs,
    pxPerSecond,
    scrollLeft,
    onSeek,
  });

  useTimelineScroll(viewportRef, onScrollChange);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedSegment || !onSegmentsChange) {
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        onSegmentsChange(removeTimelineSegment(segments, selectedSegment.id));
        onSelectionChange?.({ selectedSegmentIds: [] });
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const duplicate = duplicateTimelineSegment(selectedSegment, durationMs);
        onSegmentsChange([...segments, duplicate]);
        onSelectionChange?.({ selectedSegmentIds: [duplicate.id] });
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        try {
          const [leftSegment, rightSegment] = splitTimelineSegment(
            selectedSegment,
            currentTimeMs,
          );
          onSegmentsChange(
            segments.flatMap((segment) =>
              segment.id === selectedSegment.id
                ? [leftSegment, rightSegment]
                : [segment],
            ),
          );
          onSelectionChange?.({ selectedSegmentIds: [rightSegment.id] });
        } catch {
          return;
        }
      }
    };

    element.addEventListener("keydown", handleKeyDown);

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentTimeMs,
    durationMs,
    onSegmentsChange,
    onSelectionChange,
    segments,
    selectedSegment,
  ]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    if (Math.abs(element.scrollLeft - scrollLeft) > 1) {
      element.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  return (
    <div
      style={{
        position: "relative",
        width: viewportWidth,
        borderRadius: 16,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(15,18,24,0.98) 0%, rgba(10,12,16,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 44px -28px rgba(0,0,0,0.78)",
      }}
    >
      <TimelineControls
        pxPerSecond={pxPerSecond}
        minPxPerSecond={minPxPerSecond}
        maxPxPerSecond={maxPxPerSecond}
        selectedSegmentLabel={selectedSegment?.text ?? null}
        onZoomChange={onZoomChange}
        onSplitSelected={() => {
          if (!selectedSegment || !onSegmentsChange) {
            return;
          }

          const [leftSegment, rightSegment] = splitTimelineSegment(
            selectedSegment,
            currentTimeMs,
          );
          onSegmentsChange(
            segments.flatMap((segment) =>
              segment.id === selectedSegment.id
                ? [leftSegment, rightSegment]
                : [segment],
            ),
          );
          onSelectionChange?.({ selectedSegmentIds: [rightSegment.id] });
        }}
        onDuplicateSelected={() => {
          if (!selectedSegment || !onSegmentsChange) {
            return;
          }

          const duplicate = duplicateTimelineSegment(
            selectedSegment,
            durationMs,
          );
          onSegmentsChange([...segments, duplicate]);
          onSelectionChange?.({ selectedSegmentIds: [duplicate.id] });
        }}
        onDeleteSelected={() => {
          if (!selectedSegment || !onSegmentsChange) {
            return;
          }

          onSegmentsChange(removeTimelineSegment(segments, selectedSegment.id));
          onSelectionChange?.({ selectedSegmentIds: [] });
        }}
      />
      <div
        ref={viewportRef}
        onWheel={handleWheelZoom}
        onPointerDown={handlePlayheadPointerDown}
        tabIndex={0}
        style={{
          position: "relative",
          overflowX: "auto",
          overflowY: "hidden",
          width: "100%",
          background: "#0f1115",
          cursor: "pointer",
        }}
      >
        <div
          style={{ position: "relative", width: timelineWidth, minHeight: 224 }}
        >
          <TimelineRuler durationMs={durationMs} pxPerSecond={pxPerSecond} />
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              <TimelineGrid
                durationMs={durationMs}
                pxPerSecond={pxPerSecond}
                height={196}
              />
            </div>
            <AudioWaveformTrack
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              pxPerSecond={pxPerSecond}
              waveform={waveform}
              height={104}
            />
            <LyricsTrack
              durationMs={durationMs}
              pxPerSecond={pxPerSecond}
              segments={segments}
              selectedSegmentIds={selection?.selectedSegmentIds}
              snapPointsMs={snapPointsMs}
              snapThresholdMs={snapThresholdMs}
              onSegmentSelect={(segmentId) => {
                onSegmentSelect?.(segmentId);
                onSelectionChange?.({ selectedSegmentIds: [segmentId] });
              }}
              onSegmentChange={(segment) => {
                onSegmentChange?.(segment);
                onSegmentsChange?.(replaceTimelineSegment(segments, segment));
              }}
            />
            {markers.length > 0 ? (
              <MarkersTrack
                durationMs={durationMs}
                pxPerSecond={pxPerSecond}
                markers={markers}
              />
            ) : null}
          </div>
        </div>
        <TimelinePlayhead
          currentTimeMs={currentTimeMs}
          pxPerSecond={pxPerSecond}
          scrollLeft={scrollLeft}
        />
      </div>
    </div>
  );
}
