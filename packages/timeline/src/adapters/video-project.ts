import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import type { VideoProject } from "@spectral/project-schema";

import type { EditorTimelineProps, TimelineSelection } from "../types";

export type CreateTimelinePropsFromVideoProjectInput = {
  project: VideoProject;
  currentTimeMs: number;
  pxPerSecond: number;
  scrollLeft?: number;
  selection?: TimelineSelection;
  analysisProvider?: AudioAnalysisProvider | null;
  viewportWidth?: number | string;
  waveformPoints?: number;
  onSeek?(timeMs: number): void;
  onZoomChange?(pxPerSecond: number): void;
  onScrollChange?(scrollLeft: number): void;
  onSegmentSelect?(segmentId: string): void;
  onSegmentChange?(segment: VideoProject["lyrics"]["segments"][number]): void;
  onSelectionChange?(selection: TimelineSelection): void;
  onSegmentsChange?(segments: VideoProject["lyrics"]["segments"]): void;
};

export function createTimelinePropsFromVideoProject(
  input: CreateTimelinePropsFromVideoProjectInput,
): EditorTimelineProps {
  const snapPointsMs = Array.from(
    new Set([
      0,
      input.project.timing.durationMs,
      ...input.project.lyrics.segments.flatMap((segment) => [segment.startMs, segment.endMs]),
    ]),
  ).sort((left, right) => left - right);

  return {
    durationMs: input.project.timing.durationMs,
    currentTimeMs: input.currentTimeMs,
    pxPerSecond: input.pxPerSecond,
    scrollLeft: input.scrollLeft,
    viewportWidth: input.viewportWidth,
    waveform: input.analysisProvider
      ? input.analysisProvider.getWaveformSlice(
          0,
          input.project.timing.durationMs,
          input.waveformPoints ?? 1200,
        )
      : null,
    segments: input.project.lyrics.segments,
    markers: [],
    selection: input.selection,
    snapPointsMs,
    onSeek: input.onSeek,
    onZoomChange: input.onZoomChange,
    onScrollChange: input.onScrollChange,
    onSegmentSelect: input.onSegmentSelect,
    onSegmentChange: input.onSegmentChange,
    onSelectionChange: input.onSelectionChange,
    onSegmentsChange: input.onSegmentsChange,
  };
}
