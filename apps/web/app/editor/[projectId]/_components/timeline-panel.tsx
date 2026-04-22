"use client";

import { useEffect, useMemo, useRef } from "react";

import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import {
  usePlaybackStore,
  useProjectStore,
  useTimelineStore,
} from "@spectral/editor-store";
import {
  createTimelinePropsFromVideoProject,
  EditorTimeline,
} from "@spectral/timeline";
import { Badge } from "@spectral/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@spectral/ui/components/card";
import { Slider } from "@spectral/ui/components/slider";

type TimelinePanelProps = {
  analysisError: string | null;
  analysisLoading: boolean;
  analysisProvider: AudioAnalysisProvider | null;
};

export function TimelinePanel({
  analysisError,
  analysisLoading,
  analysisProvider,
}: TimelinePanelProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const project = useProjectStore((state) => state.project);
  const updateAtPath = useProjectStore((state) => state.updateAtPath);
  const currentTimeMs = usePlaybackStore((state) => state.currentTimeMs);
  const seekToMs = usePlaybackStore((state) => state.seekToMs);
  const pxPerSecond = useTimelineStore((state) => state.pxPerSecond);
  const scrollLeft = useTimelineStore((state) => state.scrollLeft);
  const viewportWidth = useTimelineStore((state) => state.viewportWidth);
  const selectedSegmentIds = useTimelineStore(
    (state) => state.selectedSegmentIds,
  );
  const snapThresholdMs = useTimelineStore((state) => state.snapThresholdMs);
  const setZoom = useTimelineStore((state) => state.setZoom);
  const setScrollLeft = useTimelineStore((state) => state.setScrollLeft);
  const setViewportWidth = useTimelineStore((state) => state.setViewportWidth);
  const setSelectedSegmentIds = useTimelineStore(
    (state) => state.setSelectedSegmentIds,
  );
  const waveformPoints = useMemo(() => {
    const timelineWidth = (project.timing.durationMs / 1000) * pxPerSecond;
    return Math.max(600, Math.min(6000, Math.ceil(timelineWidth / 2)));
  }, [project.timing.durationMs, pxPerSecond]);

  useEffect(() => {
    const element = viewportRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setViewportWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [setViewportWidth]);

  const timelineProps = createTimelinePropsFromVideoProject({
    project,
    currentTimeMs,
    pxPerSecond,
    scrollLeft,
    viewportWidth,
    selection: {
      selectedSegmentIds,
    },
    analysisProvider,
    onSeek: (timeMs) => seekToMs(timeMs, project.timing.fps),
    waveformPoints,
    onZoomChange: setZoom,
    onScrollChange: setScrollLeft,
    onSegmentSelect: (segmentId) => setSelectedSegmentIds([segmentId]),
    onSelectionChange: (selection) =>
      setSelectedSegmentIds(selection.selectedSegmentIds),
    onSegmentsChange: (segments) =>
      updateAtPath(["lyrics", "segments"], segments),
  });

  return (
    <Card className="flex min-h-[18rem] flex-col overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Timeline runtime</Badge>
              <Badge variant="outline">
                Duration {Math.round(project.timing.durationMs / 1000)}s
              </Badge>
              <Badge variant="outline">
                {project.lyrics.segments.length} segments
              </Badge>
            </div>
            <div>
              <CardTitle>Unified timeline</CardTitle>
              <CardDescription>
                `@spectral/timeline` consumes the live project document and
                store-backed playback state here.
              </CardDescription>
            </div>
          </div>
          <div className="min-w-56 space-y-2 rounded-[22px] border border-border/70 bg-background/60 px-4 py-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span>Timeline zoom</span>
              <span>{Math.round(pxPerSecond)} px/s</span>
            </div>
            <Slider
              max={400}
              min={40}
              step={10}
              value={[pxPerSecond]}
              onValueChange={([value]) => {
                if (value === undefined) {
                  return;
                }

                setZoom(value);
              }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1">
        <div className="space-y-4" ref={viewportRef}>
          <EditorTimeline
            {...timelineProps}
            snapThresholdMs={snapThresholdMs}
          />
          <div className="rounded-[24px] border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
            Scroll {Math.round(scrollLeft)} px · Selected segments{" "}
            {selectedSegmentIds.length} · Analysis{" "}
            {analysisProvider
              ? "ready"
              : analysisLoading
                ? "loading"
                : "missing"}
            {analysisError ? ` · ${analysisError}` : ""}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
