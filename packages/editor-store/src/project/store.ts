import {
  createDefaultVideoProject,
  normalizeVideoProject,
  type VideoProject,
} from "@spectral/project-schema";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { cloneValue, deepMerge, setValueAtPath } from "../shared/object";

const HISTORY_LIMIT = 100;

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
  updateAtPath(path: string | string[], value: unknown): void;
  markSaved(snapshotVersion?: string | null): void;
  reset(project?: VideoProject): void;
  undo(): void;
  redo(): void;
};

function pushHistory(history: VideoProject[], project: VideoProject): VideoProject[] {
  const nextHistory = [...history, cloneValue(project)];
  return nextHistory.slice(Math.max(0, nextHistory.length - HISTORY_LIMIT));
}

function resolveProjectPatch(project: VideoProject, patch: ProjectPatch): VideoProject {
  if (typeof patch === "function") {
    return normalizeVideoProject(patch(cloneValue(project)));
  }

  return normalizeVideoProject(deepMerge(project, patch));
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
    updateAtPath(path, value) {
      const current = get().project;
      const nextProject = normalizeVideoProject(setValueAtPath(current, path, value));

      set((state) => ({
        project: nextProject,
        dirty: true,
        history: pushHistory(state.history, current),
        future: [],
      }));
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
  selectDurationMs: (state: ProjectStoreState) => state.project.timing.durationMs,
  selectLyricsSegments: (state: ProjectStoreState) => state.project.lyrics.segments,
  selectDirty: (state: ProjectStoreState) => state.dirty,
};
