import { frameToTimeMs } from "@spectral/render-core";
import type { RenderSession } from "@spectral/render-session";

import type { BrowserRenderRuntime } from "../contracts/runtime";
import { createManualRenderClock } from "../clock/manual-render-clock";
import {
  createAssetResolverFromRenderSession,
  createAudioAnalysisProviderFromRenderSession,
  preloadRenderSessionFonts,
} from "../export/session";
import { createSpectralRuntimeSession } from "../runtime/create-spectral-runtime-session";

export type SpectralOfflineRuntimeLoadResult = {
  frameCount: number;
  fps: number;
  surface: {
    width: number;
    height: number;
    dpr: number;
  };
};

export type SpectralOfflineRuntimeFrameResult = {
  frame: number;
  timeMs: number;
  renderMs: number;
};

export type SpectralOfflineRuntimeCaptureOptions = {
  format?: "png";
};

export type SpectralOfflineRuntime = {
  loadSession(session: RenderSession): Promise<SpectralOfflineRuntimeLoadResult>;
  renderFrame(frame: number): Promise<SpectralOfflineRuntimeFrameResult>;
  captureFrame(options?: SpectralOfflineRuntimeCaptureOptions): Promise<string>;
  dispose(): Promise<void>;
};

type RuntimeState = {
  runtime: BrowserRenderRuntime | null;
  session: RenderSession | null;
};

function resolveSurface(session: RenderSession) {
  return {
    width: session.runtime.width,
    height: session.runtime.height,
    dpr: session.runtime.dpr,
  };
}

function assertFrameRange(frame: number, session: RenderSession) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= session.runtime.frameCount) {
    throw new Error(
      `Requested frame ${frame} is outside the render-session range 0-${session.runtime.frameCount - 1}.`,
    );
  }
}

function resolveCanvas(target: HTMLElement): HTMLCanvasElement {
  const canvas = target instanceof HTMLCanvasElement ? target : target.querySelector("canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Offline runtime canvas is not mounted.");
  }

  return canvas;
}

function captureCanvasDataUrl(target: HTMLElement): string {
  const canvas = resolveCanvas(target);
  return canvas.toDataURL("image/png");
}

export function createSpectralOfflineRuntime(input: {
  target: HTMLElement;
}): SpectralOfflineRuntime {
  const state: RuntimeState = {
    runtime: null,
    session: null,
  };

  async function disposeRuntime() {
    if (!state.runtime) {
      return;
    }

    await state.runtime.unmount();
    state.runtime = null;
    state.session = null;
  }

  return {
    async loadSession(session) {
      if (state.session?.sessionId === session.sessionId && state.runtime) {
        return {
          frameCount: session.runtime.frameCount,
          fps: session.runtime.fps,
          surface: resolveSurface(session),
        };
      }

      await disposeRuntime();
      await preloadRenderSessionFonts(session);

      const assetResolver = createAssetResolverFromRenderSession(session);
      const analysisProvider = createAudioAnalysisProviderFromRenderSession(session);
      const runtime = await createSpectralRuntimeSession({
        target: input.target,
        project: session.project.document,
        surface: resolveSurface(session),
        frameContextFps: session.runtime.fps,
        frameContextDurationMs: session.runtime.durationMs,
        analysisProvider,
        assetResolver,
        clock: createManualRenderClock({ fps: session.runtime.fps }),
        autoStart: false,
        mode: "export",
      });

      state.runtime = runtime;
      state.session = session;

      return {
        frameCount: session.runtime.frameCount,
        fps: session.runtime.fps,
        surface: resolveSurface(session),
      };
    },
    async renderFrame(frame) {
      if (!state.runtime || !state.session) {
        throw new Error("Offline runtime used before loadSession(session).");
      }

      assertFrameRange(frame, state.session);
      state.runtime.setPlaybackState(false);

      const timeMs = frameToTimeMs(frame, state.session.runtime.fps);
      const startedAt = performance.now();
      await state.runtime.renderFrameAt(timeMs);

      return {
        frame,
        timeMs,
        renderMs: performance.now() - startedAt,
      };
    },
    async captureFrame() {
      return captureCanvasDataUrl(input.target);
    },
    async dispose() {
      await disposeRuntime();
    },
  };
}

declare global {
  interface Window {
    spectralRuntime?: SpectralOfflineRuntime;
    __spectralOfflineRuntimeReady?: Promise<void>;
  }
}
