import {
  createDefaultVideoProject,
  getAspectRatioDimensions,
  normalizeVideoProject,
  type VisualizerWaveCircle,
  type SupportedAspectRatio,
  type VideoProject,
} from "@spectral/project-schema";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { cloneValue, deepMerge, setValueAtPath } from "../shared/object";

const HISTORY_LIMIT = 100;

type ProjectStoreSet = (
  partial:
    | Partial<ProjectStoreState>
    | ((state: ProjectStoreState) => Partial<ProjectStoreState>),
) => void;

type ProjectStoreGet = () => ProjectStoreState;

export type ProjectPatch =
  | Partial<VideoProject>
  | ((project: VideoProject) => VideoProject);

export type ProjectStoreState = {
  project: VideoProject;
  dirty: boolean;
  snapshotVersion: string | null;
  history: VideoProject[];
  future: VideoProject[];
  setProject(project: VideoProject, snapshotVersion?: string | null): void;
  applyPatch(patch: ProjectPatch): void;
  setAspectRatio(aspectRatio: SupportedAspectRatio): void;
  updateAtPath(path: string | string[], value: unknown): void;
  addVisualizerWaveLayer(): void;
  updateVisualizerWaveLayer(index: number, patch: Partial<VideoProject["visualizer"]["waveCircles"][number]>): void;
  updateVisualizerWaveLayerCustomOptions(index: number, patch: Record<string, unknown>): void;
  updateVisualizerWaveLayerSpinSettings(
    index: number,
    patch: Partial<VideoProject["visualizer"]["waveCircles"][number]["spinSettings"]>,
  ): void;
  removeVisualizerWaveLayer(index?: number): void;
  duplicateVisualizerWaveLayer(index: number): void;
  moveVisualizerWaveLayer(fromIndex: number, toIndex: number): void;
  markSaved(snapshotVersion?: string | null): void;
  reset(project?: VideoProject): void;
  undo(): void;
  redo(): void;
};

function pushHistory(
  history: VideoProject[],
  project: VideoProject,
): VideoProject[] {
  const nextHistory = [...history, cloneValue(project)];
  return nextHistory.slice(Math.max(0, nextHistory.length - HISTORY_LIMIT));
}

function resolveProjectPatch(
  project: VideoProject,
  patch: ProjectPatch,
): VideoProject {
  if (typeof patch === "function") {
    return normalizeVideoProject(patch(cloneValue(project)));
  }

  return normalizeVideoProject(deepMerge(project, patch));
}

function commitProjectChange(
  set: ProjectStoreSet,
  get: ProjectStoreGet,
  transform: (project: VideoProject) => VideoProject,
) {
  const current = get().project;
  const nextProject = normalizeVideoProject(transform(cloneValue(current)));

  set((state) => ({
    project: nextProject,
    dirty: true,
    history: pushHistory(state.history, current),
    future: [],
  }));
}

function createDefaultWaveLayer(): VideoProject["visualizer"]["waveCircles"][number] {
  const hexColor = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");

  return {
    fillColor: `0x${hexColor}`,
    secondaryFillColor: null,
    lineColor: "0x000000",
    secondaryLineColor: null,
    fillAlpha: 1,
    secondaryFillAlpha: 1,
    lineWidth: 0,
    lineAlpha: 1,
    secondaryLineAlpha: 1,
    visible: true,
    spinSettings: {
      enabled: false,
      speed: 0,
      acceleration: 0,
      logoLocked: false,
    },
    customOptions: {
      rotation: 0,
      waveType: "bass spectrum",
      reflectionType: "vertical",
      enabled: false,
      smoothed: true,
      inverted: false,
      waveStyle: "solid",
      waveScaleFactor: 1.2,
      barCount: 200,
      barWidth: 0.75,
      pointRadius: 1,
    },
  };
}

function canRemoveWaveLayer(waveCircles: VisualizerWaveCircle[]) {
  return waveCircles.length > 1;
}

function canAddWaveLayer(waveCircles: VisualizerWaveCircle[]) {
  return waveCircles.length < 7;
}

export const useProjectStore = create<ProjectStoreState>()(
  subscribeWithSelector((set, get) => ({
    project: createDefaultVideoProject(),
    dirty: false,
    snapshotVersion: null,
    history: [],
    future: [],
    setProject(project, snapshotVersion = null) {
      set({
        project: normalizeVideoProject(project),
        dirty: false,
        snapshotVersion,
        history: [],
        future: [],
      });
    },
    applyPatch(patch) {
      const current = get().project;
      const nextProject = resolveProjectPatch(current, patch);

      set((state) => ({
        project: nextProject,
        dirty: true,
        history: pushHistory(state.history, current),
        future: [],
      }));
    },
    setAspectRatio(aspectRatio) {
      const current = get().project;
      const dimensions = getAspectRatioDimensions(aspectRatio);
      const nextProject = normalizeVideoProject({
        ...current,
        viewport: {
          ...current.viewport,
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio,
        },
        export: {
          ...current.export,
          width: dimensions.width,
          height: dimensions.height,
        },
      });

      set((state) => ({
        project: nextProject,
        dirty: true,
        history: pushHistory(state.history, current),
        future: [],
      }));
    },
    updateAtPath(path, value) {
      const current = get().project;
      const nextProject = normalizeVideoProject(
        setValueAtPath(current, path, value),
      );

      set((state) => ({
        project: nextProject,
        dirty: true,
        history: pushHistory(state.history, current),
        future: [],
      }));
    },
    addVisualizerWaveLayer() {
      if (!canAddWaveLayer(get().project.visualizer.waveCircles)) {
        return;
      }

      commitProjectChange(set, get, (project) => ({
        ...project,
        visualizer: {
          ...project.visualizer,
          waveCircles: [
            createDefaultWaveLayer(),
            ...project.visualizer.waveCircles,
          ],
        },
      }));
    },
    updateVisualizerWaveLayer(index, patch) {
      commitProjectChange(set, get, (project) => ({
        ...project,
        visualizer: {
          ...project.visualizer,
          waveCircles: project.visualizer.waveCircles.map((layer, layerIndex) =>
            layerIndex === index
              ? {
                  ...layer,
                  ...patch,
                }
              : layer,
          ),
        },
      }));
    },
    updateVisualizerWaveLayerCustomOptions(index, patch) {
      commitProjectChange(set, get, (project) => ({
        ...project,
        visualizer: {
          ...project.visualizer,
          waveCircles: project.visualizer.waveCircles.map((layer, layerIndex) =>
            layerIndex === index
              ? {
                  ...layer,
                  customOptions: {
                    ...layer.customOptions,
                    ...patch,
                  },
                }
              : layer,
          ),
        },
      }));
    },
    updateVisualizerWaveLayerSpinSettings(index, patch) {
      commitProjectChange(set, get, (project) => ({
        ...project,
        visualizer: {
          ...project.visualizer,
          waveCircles: project.visualizer.waveCircles.map((layer, layerIndex) =>
            layerIndex === index
              ? {
                  ...layer,
                  spinSettings: {
                    ...layer.spinSettings,
                    ...patch,
                  },
                }
              : layer,
          ),
        },
      }));
    },
    removeVisualizerWaveLayer(index) {
      if (!canRemoveWaveLayer(get().project.visualizer.waveCircles)) {
        return;
      }

      commitProjectChange(set, get, (project) => {
        const nextWaveCircles = [...project.visualizer.waveCircles];
        nextWaveCircles.splice(index ?? 0, 1);

        return {
          ...project,
          visualizer: {
            ...project.visualizer,
            waveCircles: nextWaveCircles,
          },
        };
      });
    },
    duplicateVisualizerWaveLayer(index) {
      const currentWaveCircles = get().project.visualizer.waveCircles;

      if (!canAddWaveLayer(currentWaveCircles) || !currentWaveCircles[index]) {
        return;
      }

      commitProjectChange(set, get, (project) => {
        const nextWaveCircles = [...project.visualizer.waveCircles];
        const source = nextWaveCircles[index];

        if (!source) {
          return project;
        }

        nextWaveCircles.splice(index, 0, cloneValue(source));

        return {
          ...project,
          visualizer: {
            ...project.visualizer,
            waveCircles: nextWaveCircles,
          },
        };
      });
    },
    moveVisualizerWaveLayer(fromIndex, toIndex) {
      const currentWaveCircles = get().project.visualizer.waveCircles;

      if (
        !currentWaveCircles[fromIndex] ||
        toIndex < 0 ||
        toIndex >= currentWaveCircles.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      commitProjectChange(set, get, (project) => {
        const nextWaveCircles = [...project.visualizer.waveCircles];
        const source = nextWaveCircles[fromIndex];

        if (!source) {
          return project;
        }

        nextWaveCircles[fromIndex] = cloneValue(nextWaveCircles[toIndex]!);
        nextWaveCircles[toIndex] = cloneValue(source);

        return {
          ...project,
          visualizer: {
            ...project.visualizer,
            waveCircles: nextWaveCircles,
          },
        };
      });
    },
    markSaved(snapshotVersion = get().snapshotVersion) {
      set({
        dirty: false,
        snapshotVersion,
      });
    },
    reset(project = createDefaultVideoProject()) {
      set({
        project: normalizeVideoProject(project),
        dirty: false,
        snapshotVersion: null,
        history: [],
        future: [],
      });
    },
    undo() {
      const { history, project, future } = get();
      const previous = history[history.length - 1];

      if (!previous) {
        return;
      }

      set({
        project: previous,
        dirty: true,
        history: history.slice(0, -1),
        future: [cloneValue(project), ...future],
      });
    },
    redo() {
      const { future, project, history } = get();
      const nextProject = future[0];

      if (!nextProject) {
        return;
      }

      set({
        project: nextProject,
        dirty: true,
        history: pushHistory(history, project),
        future: future.slice(1),
      });
    },
  })),
);

export const projectSelectors = {
  selectProject: (state: ProjectStoreState) => state.project,
  selectDurationMs: (state: ProjectStoreState) =>
    state.project.timing.durationMs,
  selectLyricsSegments: (state: ProjectStoreState) =>
    state.project.lyrics.segments,
  selectDirty: (state: ProjectStoreState) => state.dirty,
};
