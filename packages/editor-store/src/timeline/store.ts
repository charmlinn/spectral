import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type TimelineDragSession = {
  type: "playhead" | "segment-move" | "segment-resize-start" | "segment-resize-end";
  segmentId?: string;
  startMs: number;
  currentMs: number;
};

export type TimelineStoreState = {
  pxPerSecond: number;
  scrollLeft: number;
  viewportWidth: number;
  trackHeights: Record<string, number>;
  dragSession: TimelineDragSession | null;
  hoverTimeMs: number | null;
  selectedSegmentIds: string[];
  snapEnabled: boolean;
  snapThresholdMs: number;
  setZoom(pxPerSecond: number): void;
  setScrollLeft(scrollLeft: number): void;
  setViewportWidth(viewportWidth: number): void;
  setTrackHeight(trackId: string, height: number): void;
  setDragSession(dragSession: TimelineDragSession | null): void;
  setHoverTimeMs(hoverTimeMs: number | null): void;
  setSelectedSegmentIds(selectedSegmentIds: string[]): void;
  setSnapEnabled(snapEnabled: boolean): void;
  setSnapThresholdMs(snapThresholdMs: number): void;
};

export const useTimelineStore = create<TimelineStoreState>()(
  subscribeWithSelector((set) => ({
    pxPerSecond: 120,
    scrollLeft: 0,
    viewportWidth: 0,
    trackHeights: {
      waveform: 96,
      lyrics: 72,
      markers: 28,
    },
    dragSession: null,
    hoverTimeMs: null,
    selectedSegmentIds: [],
    snapEnabled: true,
    snapThresholdMs: 80,
    setZoom(pxPerSecond) {
      set({ pxPerSecond });
    },
    setScrollLeft(scrollLeft) {
      set({ scrollLeft });
    },
    setViewportWidth(viewportWidth) {
      set({ viewportWidth });
    },
    setTrackHeight(trackId, height) {
      set((state) => ({
        trackHeights: {
          ...state.trackHeights,
          [trackId]: height,
        },
      }));
    },
    setDragSession(dragSession) {
      set({ dragSession });
    },
    setHoverTimeMs(hoverTimeMs) {
      set({ hoverTimeMs });
    },
    setSelectedSegmentIds(selectedSegmentIds) {
      set({ selectedSegmentIds });
    },
    setSnapEnabled(snapEnabled) {
      set({ snapEnabled });
    },
    setSnapThresholdMs(snapThresholdMs) {
      set({ snapThresholdMs });
    },
  })),
);
