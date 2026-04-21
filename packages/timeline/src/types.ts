import type { WaveformOverview } from "@spectral/audio-analysis";
import type { LyricsSegment } from "@spectral/project-schema";

export type TimelineLyricsSegment = LyricsSegment;

export type TimelineMarker = {
  id: string;
  timeMs: number;
  label: string;
  color?: string;
};

export type TimelineSelection = {
  selectedSegmentIds: string[];
};

export type EditorTimelineProps = {
  durationMs: number;
  currentTimeMs: number;
  pxPerSecond: number;
  scrollLeft?: number;
  viewportWidth?: number | string;
  waveform?: WaveformOverview | null;
  segments: TimelineLyricsSegment[];
  markers?: TimelineMarker[];
  selection?: TimelineSelection;
  minPxPerSecond?: number;
  maxPxPerSecond?: number;
  snapPointsMs?: number[];
  snapThresholdMs?: number;
  onSeek?(timeMs: number): void;
  onZoomChange?(pxPerSecond: number): void;
  onScrollChange?(scrollLeft: number): void;
  onSegmentSelect?(segmentId: string): void;
  onSegmentChange?(segment: TimelineLyricsSegment): void;
  onSelectionChange?(selection: TimelineSelection): void;
  onSegmentsChange?(segments: TimelineLyricsSegment[]): void;
};

export type TimelineGridProps = {
  durationMs: number;
  pxPerSecond: number;
  height: number;
};

export type TimelineRulerProps = {
  durationMs: number;
  pxPerSecond: number;
};

export type TimelinePlayheadProps = {
  currentTimeMs: number;
  pxPerSecond: number;
  scrollLeft: number;
};

export type AudioWaveformTrackProps = {
  durationMs: number;
  pxPerSecond: number;
  waveform: WaveformOverview | null | undefined;
  height?: number;
};

export type LyricsTrackProps = {
  durationMs: number;
  pxPerSecond: number;
  segments: TimelineLyricsSegment[];
  selectedSegmentIds?: string[];
  snapPointsMs?: number[];
  snapThresholdMs?: number;
  onSegmentSelect?(segmentId: string): void;
  onSegmentChange?(segment: TimelineLyricsSegment): void;
};
