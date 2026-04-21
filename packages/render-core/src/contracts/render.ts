import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import type {
  LyricsSegment,
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
  amplitude: number;
};

export type LyricsLayerProps = {
  activeSegment: LyricsSegment | null;
  previousSegment: LyricsSegment | null;
  nextSegment: LyricsSegment | null;
};

export type BackdropLayerProps = {
  viewport: ViewportSettings;
  assetId: string | null;
  sourceKind: string | null;
};

export type TextLayerProps = {
  layer: TextLayer;
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
};
