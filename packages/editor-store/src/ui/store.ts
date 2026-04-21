import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type EditorPanelsState = {
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  exportDrawerOpen: boolean;
};

export type EditorUiStoreState = {
  panels: EditorPanelsState;
  currentTab: string;
  dialogs: Record<string, boolean>;
  drawers: Record<string, boolean>;
  selectedObjectId: string | null;
  hoveredObjectId: string | null;
  setPanel<K extends keyof EditorPanelsState>(panel: K, value: EditorPanelsState[K]): void;
  setCurrentTab(currentTab: string): void;
  setDialog(id: string, open: boolean): void;
  setDrawer(id: string, open: boolean): void;
  setSelectedObjectId(selectedObjectId: string | null): void;
  setHoveredObjectId(hoveredObjectId: string | null): void;
};

export const useEditorUiStore = create<EditorUiStoreState>()(
  subscribeWithSelector((set) => ({
    panels: {
      sidebarOpen: true,
      inspectorOpen: true,
      exportDrawerOpen: false,
    },
    currentTab: "general",
    dialogs: {},
    drawers: {},
    selectedObjectId: null,
    hoveredObjectId: null,
    setPanel(panel, value) {
      set((state) => ({
        panels: {
          ...state.panels,
          [panel]: value,
        },
      }));
    },
    setCurrentTab(currentTab) {
      set({ currentTab });
    },
    setDialog(id, open) {
      set((state) => ({
        dialogs: {
          ...state.dialogs,
          [id]: open,
        },
      }));
    },
    setDrawer(id, open) {
      set((state) => ({
        drawers: {
          ...state.drawers,
          [id]: open,
        },
      }));
    },
    setSelectedObjectId(selectedObjectId) {
      set({ selectedObjectId });
    },
    setHoveredObjectId(hoveredObjectId) {
      set({ hoveredObjectId });
    },
  })),
);
