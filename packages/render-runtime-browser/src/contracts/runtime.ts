import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import type {
  BuildSceneGraphInput,
  RenderAssetResolver,
  RenderClock,
  RenderFrameContext,
  RenderLayer,
  RenderSceneGraph,
  RenderSurface,
} from "@spectral/render-core";
import type { VideoProject } from "@spectral/project-schema";

export type BrowserRenderAdapterMountTarget = HTMLElement | HTMLCanvasElement;

export type BrowserRenderAdapterRenderInput = {
  analysisProvider?: AudioAnalysisProvider | null;
  historyProvider?: AudioAnalysisProvider | null;
  sceneGraph: RenderSceneGraph;
  visibleLayers: RenderLayer[];
  frameContext: RenderFrameContext;
  surface: RenderSurface;
};

export type BrowserRenderAdapter = {
  mount(
    target: BrowserRenderAdapterMountTarget,
    surface: RenderSurface,
  ): void | Promise<void>;
  resize(surface: RenderSurface): void | Promise<void>;
  render(input: BrowserRenderAdapterRenderInput): void | Promise<void>;
  destroy(): void | Promise<void>;
};

export type BrowserRenderRuntimeOptions = {
  adapter: BrowserRenderAdapter;
  project: VideoProject;
  surface: RenderSurface;
  clock?: RenderClock | null;
  analysisProvider?: AudioAnalysisProvider | null;
  historyProvider?: AudioAnalysisProvider | null;
  assetResolver?: RenderAssetResolver | null;
  autoStart?: boolean;
  onFrame?: (input: BrowserRenderAdapterRenderInput) => void;
  buildSceneGraph?: (input: BuildSceneGraphInput) => RenderSceneGraph;
};

export type BrowserRenderRuntime = {
  mount(target: BrowserRenderAdapterMountTarget): Promise<void>;
  unmount(): Promise<void>;
  setProject(project: VideoProject): void;
  setClock(clock: RenderClock | null): void;
  setSurface(surface: RenderSurface): Promise<void>;
  setAudioAnalysisProvider(provider: AudioAnalysisProvider | null): void;
  setHistoryProvider(provider: AudioAnalysisProvider | null): void;
  setAssetResolver(assetResolver: RenderAssetResolver | null): void;
  start(): void;
  stop(): void;
  renderFrameAt(timeMs: number): Promise<BrowserRenderAdapterRenderInput>;
};

export type PreviewStageRuntimeOptions = {
  target: BrowserRenderAdapterMountTarget;
  project: VideoProject;
  surface: RenderSurface;
  audioElement: HTMLMediaElement;
  analysisProvider: AudioAnalysisProvider;
  assetResolver?: RenderAssetResolver | null;
  adapter?: BrowserRenderAdapter;
  autoStart?: boolean;
};

export type RenderPageRuntimeOptions = {
  target: BrowserRenderAdapterMountTarget;
  project: VideoProject;
  surface: RenderSurface;
  analysisProvider: AudioAnalysisProvider;
  assetResolver?: RenderAssetResolver | null;
  adapter?: BrowserRenderAdapter;
  clock?: RenderClock | null;
  autoStart?: boolean;
};
