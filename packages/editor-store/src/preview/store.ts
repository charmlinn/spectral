import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type { SupportedAspectRatio } from "@spectral/project-schema";

export type PreviewRuntimeHealth = "idle" | "ready" | "warning" | "error";
export type PreviewRenderQuality = "draft" | "balanced" | "high";

export type PreviewStoreState = {
  surfaceWidth: number;
  surfaceHeight: number;
  dpr: number;
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: SupportedAspectRatio;
  renderQuality: PreviewRenderQuality;
  runtimeHealth: PreviewRuntimeHealth;
  refreshToken: number;
  setSurface(width: number, height: number, dpr?: number): void;
  syncViewport(
    width: number,
    height: number,
    aspectRatio: SupportedAspectRatio,
  ): void;
  setRenderQuality(renderQuality: PreviewRenderQuality): void;
  setRuntimeHealth(runtimeHealth: PreviewRuntimeHealth): void;
  bumpRefreshToken(): void;
};

export const usePreviewStore = create<PreviewStoreState>()(
  subscribeWithSelector((set) => ({
    surfaceWidth: 1080,
    surfaceHeight: 1080,
    dpr: 1,
    viewportWidth: 1080,
    viewportHeight: 1080,
    aspectRatio: "1:1",
    renderQuality: "balanced",
    runtimeHealth: "idle",
    refreshToken: 0,
    setSurface(width, height, dpr = 1) {
      set({ surfaceWidth: width, surfaceHeight: height, dpr });
    },
    syncViewport(width, height, aspectRatio) {
      set({
        viewportWidth: width,
        viewportHeight: height,
        aspectRatio,
      });
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
