import type {
  RenderSession,
  RenderSessionAudioAnalysisSnapshot,
} from "@spectral/render-session";

export type RenderPageBootstrapPayload = {
  protocolVersion: string;
  session: RenderSession;
  exportJob: {
    id: string;
    projectId: string;
    status: string;
    format: string;
    width: number;
    height: number;
    fps: number;
    durationMs: number | null;
  };
  surface: {
    width: number;
    height: number;
    dpr: number;
  };
  runtime: {
    mode: string;
    fps: number;
    durationMs: number;
    frameCount: number;
    targetElementId: string;
  };
  media: {
    analysisId: string | null;
    analysis: RenderSessionAudioAnalysisSnapshot | null;
    assetBindings: RenderSession["assets"]["bindings"];
  };
  routes: RenderSession["routes"]["public"] & {
    internal: RenderSession["routes"]["internal"];
  };
};

export type SpectralRendererDriverInit = {
  session: RenderSession;
  bootstrap?: RenderPageBootstrapPayload | null;
};

export type SpectralRendererDriverSurfaceInfo = {
  width: number;
  height: number;
  dpr: number;
};

export type SpectralRendererFrameResult = {
  frame: number;
  timeMs: number;
  width: number;
  height: number;
  renderMs: number;
  captureMs: number;
  format: "png";
  byteLength: number;
};

export type SpectralRendererDriverInitResult = {
  surface: SpectralRendererDriverSurfaceInfo;
  frameCount: number;
  fps: number;
};

export type SpectralRendererDriver = {
  init(input: SpectralRendererDriverInit): Promise<SpectralRendererDriverInitResult>;
  warmup(frame?: number): Promise<void>;
  renderFrame(frame: number): Promise<SpectralRendererFrameResult>;
  captureFrame(format?: "png"): Promise<ArrayBuffer>;
  getSession(): RenderSession | null;
  dispose(): Promise<void>;
};

declare global {
  interface Window {
    __spectralRenderDriver?: SpectralRendererDriver;
  }
}
