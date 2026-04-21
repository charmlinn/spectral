import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type LoopRegion = {
  startMs: number;
  endMs: number;
};

export type PlaybackStoreState = {
  playing: boolean;
  currentTimeMs: number;
  currentFrame: number;
  muted: boolean;
  playbackRate: number;
  loopRegion: LoopRegion | null;
  play(): void;
  pause(): void;
  toggle(): void;
  seekToMs(timeMs: number, fps?: number): void;
  seekToFrame(frame: number, fps: number): void;
  setPlaybackRate(playbackRate: number): void;
  setMuted(muted: boolean): void;
  setLoopRegion(region: LoopRegion | null): void;
};

export const usePlaybackStore = create<PlaybackStoreState>()(
  subscribeWithSelector((set) => ({
    playing: false,
    currentTimeMs: 0,
    currentFrame: 0,
    muted: false,
    playbackRate: 1,
    loopRegion: null,
    play() {
      set({ playing: true });
    },
    pause() {
      set({ playing: false });
    },
    toggle() {
      set((state) => ({ playing: !state.playing }));
    },
    seekToMs(timeMs, fps = 30) {
      set({
        currentTimeMs: Math.max(0, timeMs),
        currentFrame: Math.round((Math.max(0, timeMs) / 1000) * fps),
      });
    },
    seekToFrame(frame, fps) {
      set({
        currentFrame: Math.max(0, frame),
        currentTimeMs: (Math.max(0, frame) / fps) * 1000,
      });
    },
    setPlaybackRate(playbackRate) {
      set({ playbackRate });
    },
    setMuted(muted) {
      set({ muted });
    },
    setLoopRegion(loopRegion) {
      set({ loopRegion });
    },
  })),
);
