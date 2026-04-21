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
  sceneGraph: RenderSceneGraph;
  visibleLayers: RenderLayer[];
  frameContext: RenderFrameContext;
  surface: RenderSurface;
};

export type BrowserRenderAdapter = {
  mount(target: BrowserRenderAdapterMountTarget, surface: RenderSurface): void | Promise<void>;
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
  start(): void;
  stop(): void;
  renderFrameAt(timeMs: number): Promise<BrowserRenderAdapterRenderInput>;
};
