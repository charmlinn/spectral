import {
  buildSceneGraph,
  createFrameContext,
  resolveVisibleLayers,
} from "@spectral/render-core";

import type {
  BrowserRenderAdapterRenderInput,
  BrowserRenderRuntime,
  BrowserRenderRuntimeOptions,
} from "../contracts/runtime";

export function createBrowserRenderRuntime(
  options: BrowserRenderRuntimeOptions,
): BrowserRenderRuntime {
  let mountedTarget: HTMLElement | HTMLCanvasElement | null = null;
  let project = options.project;
  let surface = options.surface;
  let clock = options.clock ?? null;
  let analysisProvider = options.analysisProvider ?? null;
  let historyProvider = options.historyProvider ?? null;
  let assetResolver = options.assetResolver ?? null;
  let rafId: number | null = null;
  let running = false;

  const buildScene = options.buildSceneGraph ?? buildSceneGraph;

  async function renderFrameAt(
    timeMs: number,
  ): Promise<BrowserRenderAdapterRenderInput> {
    const frameContext = createFrameContext(
      timeMs,
      project.timing.fps,
      project.timing.durationMs,
    );
    const sceneGraph = buildScene({
      project,
      frameContext,
      surface,
      analysisProvider,
    });
    const visibleLayers = resolveVisibleLayers(sceneGraph.layers, frameContext);
    const input = {
      analysisProvider,
      historyProvider,
      sceneGraph,
      visibleLayers,
      frameContext,
      surface,
    };

    await options.adapter.render(input);
    options.onFrame?.(input);

    return input;
  }

  function stopLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick(): void {
    if (!running) {
      return;
    }

    const currentTimeMs = clock?.getCurrentTimeMs() ?? 0;
    void renderFrameAt(currentTimeMs);
    rafId = requestAnimationFrame(() => tick());
  }

  return {
    async mount(target) {
      mountedTarget = target;
      await options.adapter.mount(target, surface);

      if (options.autoStart) {
        this.start();
      }
    },
    async unmount() {
      stopLoop();
      running = false;
      await options.adapter.destroy();
      mountedTarget = null;
    },
    setProject(nextProject) {
      project = nextProject;
    },
    setClock(nextClock) {
      clock = nextClock;
    },
    async setSurface(nextSurface) {
      surface = nextSurface;

      if (mountedTarget) {
        await options.adapter.resize(nextSurface);
      }
    },
    setAudioAnalysisProvider(provider) {
      analysisProvider = provider;
    },
    setHistoryProvider(provider) {
      historyProvider = provider;
    },
    setAssetResolver(nextAssetResolver) {
      assetResolver = nextAssetResolver;
      void assetResolver;
    },
    start() {
      if (running) {
        return;
      }

      running = true;
      tick();
    },
    stop() {
      running = false;
      stopLoop();
    },
    renderFrameAt,
  };
}
