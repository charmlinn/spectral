import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type PreviewRuntimeHealth = "idle" | "ready" | "warning" | "error";
export type PreviewRenderQuality = "draft" | "balanced" | "high";

export type PreviewStoreState = {
  width: number;
  height: number;
  dpr: number;
  aspectRatio: string;
  renderQuality: PreviewRenderQuality;
  runtimeHealth: PreviewRuntimeHealth;
  refreshToken: number;
  setSurface(width: number, height: number, dpr?: number): void;
  setAspectRatio(aspectRatio: string): void;
  setRenderQuality(renderQuality: PreviewRenderQuality): void;
  setRuntimeHealth(runtimeHealth: PreviewRuntimeHealth): void;
  bumpRefreshToken(): void;
};

export const usePreviewStore = create<PreviewStoreState>()(
  subscribeWithSelector((set) => ({
    width: 1080,
    height: 1080,
    dpr: 1,
    aspectRatio: "1:1",
    renderQuality: "balanced",
    runtimeHealth: "idle",
    refreshToken: 0,
    setSurface(width, height, dpr = 1) {
      set({ width, height, dpr });
    },
    setAspectRatio(aspectRatio) {
      set({ aspectRatio });
    },
    setRenderQuality(renderQuality) {
      set({ renderQuality });
    },
    setRuntimeHealth(runtimeHealth) {
      set({ runtimeHealth });
    },
    bumpRefreshToken() {
      set((state) => ({ refreshToken: state.refreshToken + 1 }));
    },
  })),
);
