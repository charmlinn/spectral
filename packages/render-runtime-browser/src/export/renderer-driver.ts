import { frameToTimeMs } from "@spectral/render-core";
import type { RenderSession } from "@spectral/render-session";

import type { BrowserRenderRuntime } from "../contracts/runtime";
import { bootstrapRenderPageRuntime } from "../runtime/bootstrap-render-page-runtime";
import {
  createAssetResolverFromRenderSession,
  createAudioAnalysisProviderFromRenderSession,
  preloadRenderSessionFonts,
} from "./session";
import type {
  RenderPageBootstrapPayload,
  SpectralRendererDriver,
  SpectralRendererDriverInit,
  SpectralRendererDriverInitResult,
  SpectralRendererFrameResult,
} from "./types";

type CreateSpectralRendererDriverOptions = {
  target: HTMLElement;
  bootstrap?: RenderPageBootstrapPayload | null;
};

type DriverState = {
  runtime: BrowserRenderRuntime | null;
  session: RenderSession | null;
  initResult: SpectralRendererDriverInitResult | null;
};

function resolveSurface(session: RenderSession) {
  return {
    width: session.runtime.width,
    height: session.runtime.height,
    dpr: session.runtime.dpr,
  };
}

function resolveCanvas(target: HTMLElement): HTMLCanvasElement | null {
  if (target instanceof HTMLCanvasElement) {
    return target;
  }

  const canvas = target.querySelector("canvas");
  return canvas instanceof HTMLCanvasElement ? canvas : null;
}

function encodeCanvasBlob(canvas: HTMLCanvasElement, format: "png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`Failed to encode frame as ${format}.`));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

async function captureCanvas(
  target: HTMLElement,
  format: "png",
): Promise<ArrayBuffer> {
  const canvas = resolveCanvas(target);

  if (!canvas) {
    throw new Error("Render driver canvas is not mounted.");
  }

  const blob = await encodeCanvasBlob(canvas, format);
  return blob.arrayBuffer();
}

function assertFrameRange(frame: number, session: RenderSession) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= session.runtime.frameCount) {
    throw new Error(
      `Requested frame ${frame} is outside the render-session range 0-${session.runtime.frameCount - 1}.`,
    );
  }
}

export function createSpectralRendererDriver(
  options: CreateSpectralRendererDriverOptions,
): SpectralRendererDriver {
  const state: DriverState = {
    runtime: null,
    session: null,
    initResult: null,
  };

  async function disposeRuntime() {
    if (!state.runtime) {
      return;
    }

    await state.runtime.unmount();
    state.runtime = null;
  }

  async function initialize(
    input: SpectralRendererDriverInit,
  ): Promise<SpectralRendererDriverInitResult> {
    if (state.session?.sessionId === input.session.sessionId && state.runtime && state.initResult) {
      return state.initResult;
    }

    await disposeRuntime();
    await preloadRenderSessionFonts(input.session);

    const assetResolver = createAssetResolverFromRenderSession(input.session);
    const analysisProvider = createAudioAnalysisProviderFromRenderSession(input.session);
    const runtime = await bootstrapRenderPageRuntime({
      target: options.target,
      project: input.session.project.document,
      surface: resolveSurface(input.session),
      fps: input.session.runtime.fps,
      durationMs: input.session.runtime.durationMs,
      analysisProvider,
      assetResolver,
      autoStart: false,
    });

    state.runtime = runtime;
    state.session = input.session;
    state.initResult = {
      surface: resolveSurface(input.session),
      frameCount: input.session.runtime.frameCount,
      fps: input.session.runtime.fps,
    };

    return state.initResult;
  }

  async function ensureInitialized() {
    if (!state.runtime || !state.session || !state.initResult) {
      const bootstrapSession = options.bootstrap?.session ?? null;

      if (!bootstrapSession) {
        throw new Error("Render driver used before init(session).");
      }

      await initialize({
        session: bootstrapSession,
        bootstrap: options.bootstrap,
      });
    }

    return {
      runtime: state.runtime!,
      session: state.session!,
      initResult: state.initResult!,
    };
  }

  return {
    async init(input) {
      return initialize(input);
    },
    async warmup(frame = 0) {
      const { runtime, session } = await ensureInitialized();
      assertFrameRange(frame, session);
      runtime.setPlaybackState(false);
      await runtime.renderFrameAt(frameToTimeMs(frame, session.runtime.fps));
    },
    async renderFrame(frame): Promise<SpectralRendererFrameResult> {
      const { runtime, session, initResult } = await ensureInitialized();
      assertFrameRange(frame, session);
      runtime.setPlaybackState(false);

      const timeMs = frameToTimeMs(frame, session.runtime.fps);
      const renderStart = performance.now();
      await runtime.renderFrameAt(timeMs);
      const renderMs = performance.now() - renderStart;

      return {
        frame,
        timeMs,
        width: initResult.surface.width,
        height: initResult.surface.height,
        renderMs,
        captureMs: 0,
        format: "png",
        byteLength: 0,
      };
    },
    async captureFrame(format = "png") {
      await ensureInitialized();
      return captureCanvas(options.target, format);
    },
    getSession() {
      return state.session;
    },
    async dispose() {
      await disposeRuntime();
      state.session = null;
      state.initResult = null;
    },
  };
}
