import type {
  BrowserRenderAdapter,
  BrowserRenderAdapterMountTarget,
  BrowserRenderAdapterRenderInput,
} from "../contracts/runtime";

export type MemorySceneAdapter = BrowserRenderAdapter & {
  getLastRender(): BrowserRenderAdapterRenderInput | null;
};

export function createMemorySceneAdapter(): MemorySceneAdapter {
  let mountedTarget: BrowserRenderAdapterMountTarget | null = null;
  let lastRender: BrowserRenderAdapterRenderInput | null = null;

  return {
    mount(target) {
      mountedTarget = target;
    },
    resize() {
      return undefined;
    },
    render(input) {
      if (!mountedTarget) {
        throw new Error("MemorySceneAdapter.render called before mount.");
      }

      lastRender = input;
    },
    destroy() {
      mountedTarget = null;
      lastRender = null;
    },
    getLastRender() {
      return lastRender;
    },
  };
}
