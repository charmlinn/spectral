import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import type {
  LyricsSegment,
  ParticleSettings,
  ReflectionSettings,
  HlsAdjustment,
  TextStyle,
  MediaReference,
  TextLayer,
  VideoProject,
  ViewportSettings,
  VisualizerConfig,
} from "@spectral/project-schema";

export type RenderSurface = {
  width: number;
  height: number;
  dpr: number;
};

export type RenderClock = {
  getCurrentTimeMs(): number;
  getCurrentFrame(): number;
  seekToMs(ms: number): void;
};

export type RenderFrameContext = {
  timeMs: number;
  frame: number;
  fps: number;
  durationMs: number;
  progress: number;
};

export type RenderAssetResolver = {
  resolveImage(assetId: string): Promise<string>;
  resolveVideo(assetId: string): Promise<string>;
  resolveAudio(assetId: string): Promise<string>;
  resolveFont(fontId: string): Promise<string | null>;
};

export type VisualizerLayerProps = {
  config: VisualizerConfig;
  spectrum: Float32Array;
  bassSpectrum: Float32Array;
  amplitude: number;
  bassAmplitude: number;
};

export type LyricsLayerProps = {
  activeSegment: LyricsSegment | null;
  previousSegment: LyricsSegment | null;
  nextSegment: LyricsSegment | null;
  style: TextStyle;
  amplitude: number;
};

export type BackdropLayerProps = {
  viewport: ViewportSettings;
  source: MediaReference | null;
  sourceKind: string | null;
  bounceEnabled: boolean;
  bounceScale: number;
  paddingFactor: number;
  reflection: ReflectionSettings;
  hlsAdjustment: HlsAdjustment;
  rotation: number;
  shakeEnabled: boolean;
  shakeFactor: number;
  filterEnabled: boolean;
  vignetteEnabled: boolean;
  maxVignette: number;
  vignetteFactor: number;
  contrastEnabled: boolean;
  maxContrast: number;
  contrastFactor: number;
  zoomBlurEnabled: boolean;
  maxZoomBlur: number;
  zoomBlurFactor: number;
  amplitude: number;
  bassAmplitude: number;
  drift: VideoProject["backdrop"]["drift"];
};

export type TextLayerProps = {
  layer: TextLayer;
  amplitude: number;
};

export type ParticleLayerProps = {
  particles: ParticleSettings;
  amplitude: number;
  bassSpectrum: Float32Array;
};

export type RenderLayer =
  | {
      id: "backdrop";
      kind: "backdrop";
      zIndex: number;
      startMs: number;
      endMs: number | null;
      props: BackdropLayerProps;
    }
  | {
      id: "visualizer";
      kind: "visualizer";
      zIndex: number;
      startMs: number;
      endMs: number | null;
      props: VisualizerLayerProps;
    }
  | {
      id: "lyrics";
      kind: "lyrics";
      zIndex: number;
      startMs: number;
      endMs: number | null;
      props: LyricsLayerProps;
    }
  | {
      id: "particles";
      kind: "particles";
      zIndex: number;
      startMs: number;
      endMs: number | null;
      props: ParticleLayerProps;
    }
  | {
      id: string;
      kind: "text";
      zIndex: number;
      startMs: number;
      endMs: number | null;
      props: TextLayerProps;
    };

export type RenderSceneGraph = {
  project: VideoProject;
  frameContext: RenderFrameContext;
  surface: RenderSurface;
  layers: RenderLayer[];
};

export type VisualizerBar = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
};

export type BuildSceneGraphInput = {
  project: VideoProject;
  frameContext: RenderFrameContext;
  surface: RenderSurface;
  analysisProvider?: AudioAnalysisProvider | null;
  historyProvider?: AudioAnalysisProvider | null;
};
