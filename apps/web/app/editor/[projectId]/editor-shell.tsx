"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { PanelRight } from "lucide-react";

import {
  useEditorUiStore,
  useExportStore,
  usePlaybackStore,
  usePreviewStore,
  useProjectStore,
} from "@spectral/editor-store";
import { Button } from "@spectral/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@spectral/ui/components/sheet";

import {
  createExportJob,
  getExportJob,
  mapExportEventToStoreEvent,
  mapExportJobToSummary,
  type ExportJobDto,
  type ProjectDetailDto,
  saveProjectSnapshot,
} from "@/src/lib/editor-api";
import { useProjectAudioAnalysis } from "@/src/lib/use-project-audio-analysis";

import { EditorHeader } from "./_components/editor-header";
import { EditorSidebar } from "./_components/editor-sidebar";
import { InspectorPanel } from "./_components/inspector-panel";
import { PreviewStage } from "./_components/preview-stage";
import { TimelinePanel } from "./_components/timeline-panel";

type EditorShellProps = {
  projectId: string;
  initialProjectDetail: ProjectDetailDto;
  initialExportJobs: ExportJobDto[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
type ExportState = "idle" | "creating" | "error";

const exportEventTypes = [
  "queued",
  "started",
  "completed",
  "failed",
  "retry_scheduled",
  "publish_failed",
  "cancelled",
  "error",
] as const;

function pickCurrentJobId(jobs: ExportJobDto[]) {
  return (
    jobs.find((job) => job.status === "queued" || job.status === "running")
      ?.id ??
    jobs[0]?.id ??
    null
  );
}

export function EditorShell({
  projectId,
  initialProjectDetail,
  initialExportJobs,
}: EditorShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState(
    initialProjectDetail.activeSnapshot?.createdAt ?? null,
  );

  const setProject = useProjectStore((state) => state.setProject);
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const setJobs = useExportStore((state) => state.setJobs);
  const setCurrentJobId = useExportStore((state) => state.setCurrentJobId);
  const currentJobId = useExportStore((state) => state.currentJobId);
  const setSseConnectionState = useExportStore(
    (state) => state.setSseConnectionState,
  );
  const appendEvent = useExportStore((state) => state.appendEvent);
  const upsertJob = useExportStore((state) => state.upsertJob);
  const inspectorOpen = useEditorUiStore((state) => state.panels.inspectorOpen);
  const setPanel = useEditorUiStore((state) => state.setPanel);
  const setCurrentTab = useEditorUiStore((state) => state.setCurrentTab);
  const pause = usePlaybackStore((state) => state.pause);
  const seekToMs = usePlaybackStore((state) => state.seekToMs);
  const setMuted = usePlaybackStore((state) => state.setMuted);
  const setPlaybackRate = usePlaybackStore((state) => state.setPlaybackRate);
  const setLoopRegion = usePlaybackStore((state) => state.setLoopRegion);
  const syncViewport = usePreviewStore((state) => state.syncViewport);
  const setRuntimeHealth = usePreviewStore((state) => state.setRuntimeHealth);
  const analysis = useProjectAudioAnalysis({
    analysisId: project.audio.analysisId,
    project,
  });

  useEffect(() => {
    if (
      !initialProjectDetail.activeProject ||
      !initialProjectDetail.activeSnapshot
    ) {
      return;
    }

    setProject(
      initialProjectDetail.activeProject,
      initialProjectDetail.activeSnapshot.id,
    );
    setJobs(initialExportJobs.map(mapExportJobToSummary));
    setCurrentJobId(pickCurrentJobId(initialExportJobs));
    setCurrentTab("general");
    setPanel("inspectorOpen", true);
    pause();
    seekToMs(0, initialProjectDetail.activeProject.timing.fps);
    setMuted(false);
    setPlaybackRate(1);
    setLoopRegion(null);
    syncViewport(
      initialProjectDetail.activeProject.viewport.width,
      initialProjectDetail.activeProject.viewport.height,
      initialProjectDetail.activeProject.viewport.aspectRatio,
    );
    setRuntimeHealth("idle");
    setLastSavedAt(initialProjectDetail.activeSnapshot.createdAt);
    setSaveState("idle");
    setSaveError(null);
    setExportState("idle");
    setExportError(null);
    setHydrated(true);
  }, [
    initialExportJobs,
    initialProjectDetail,
    pause,
    seekToMs,
    setCurrentJobId,
    setCurrentTab,
    setJobs,
    setLoopRegion,
    setMuted,
    setPanel,
    setPlaybackRate,
    setProject,
    setRuntimeHealth,
    syncViewport,
  ]);

  useEffect(() => {
    syncViewport(
      project.viewport.width,
      project.viewport.height,
      project.viewport.aspectRatio,
    );
  }, [
    project.viewport.aspectRatio,
    project.viewport.height,
    project.viewport.width,
    syncViewport,
  ]);

  useEffect(() => {
    if (!dirty && saveState === "saved") {
      return;
    }

    if (dirty && saveState !== "saving") {
      setSaveState("idle");
    }
  }, [dirty, saveState]);

  const saveCurrentProject = useEffectEvent(async (reason: string) => {
    const projectState = useProjectStore.getState();

    if (!projectState.dirty && projectState.snapshotVersion) {
      setSaveState("saved");
      return projectState.snapshotVersion;
    }

    const payload = projectState.project;
    setSaveState("saving");
    setSaveError(null);

    try {
      const response = await saveProjectSnapshot(projectId, {
        projectData: payload,
        source: "editor-shell",
        reason,
      });

      if (useProjectStore.getState().project === payload) {
        if (response.project.activeProject) {
          useProjectStore.getState().setProject(
            response.project.activeProject,
            response.snapshot.id,
          );
        } else {
          useProjectStore.getState().markSaved(response.snapshot.id);
        }
      }

      setLastSavedAt(response.snapshot.createdAt);
      setSaveState("saved");
      return response.snapshot.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save project.";
      setSaveState("error");
      setSaveError(message);
      throw error;
    }
  });

  const createExportRequest = useEffectEvent(async () => {
    setExportState("creating");
    setExportError(null);

    try {
      const projectState = useProjectStore.getState();
      const exportSnapshotId =
        projectState.dirty || !projectState.snapshotVersion
          ? await saveCurrentProject("pre-export")
          : projectState.snapshotVersion;

      const response = await createExportJob({
        projectId,
        snapshotId: exportSnapshotId,
        format: projectState.project.export.format,
        width: projectState.project.export.width,
        height: projectState.project.export.height,
        fps: projectState.project.export.fps,
        durationMs: projectState.project.timing.durationMs,
      });

      upsertJob(mapExportJobToSummary(response.job));
      setCurrentJobId(response.job.id);
      setExportState("idle");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create export job.";
      setExportState("error");
      setExportError(message);
    }
  });

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const autosaveTimer = window.setTimeout(() => {
      void saveCurrentProject("autosave");
    }, 1500);

    return () => {
      window.clearTimeout(autosaveTimer);
    };
  }, [dirty, project, saveCurrentProject]);

  useEffect(() => {
    if (!currentJobId) {
      setSseConnectionState("idle");
      return;
    }

    const source = new EventSource(`/api/events/exports/${currentJobId}`);

    setSseConnectionState("connecting");

    const refreshCurrentJob = async () => {
      try {
        const detail = await getExportJob(currentJobId);
        upsertJob(mapExportJobToSummary(detail.job));
      } catch {
        setSseConnectionState("error");
      }
    };

    void refreshCurrentJob();

    const handleEvent = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;

      try {
        const parsed = JSON.parse(messageEvent.data) as {
          id: string;
          jobId: string;
          type: string;
          createdAt: string;
          payload: Record<string, unknown>;
        };

        appendEvent(
          mapExportEventToStoreEvent({
            ...parsed,
            projectId,
            level: "info",
            message: null,
            progress: null,
          }),
        );
        void refreshCurrentJob();
      } catch {
        setSseConnectionState("error");
      }
    };

    source.onopen = () => {
      setSseConnectionState("open");
    };

    source.onerror = () => {
      setSseConnectionState("error");
    };

    for (const eventType of exportEventTypes) {
      source.addEventListener(eventType, handleEvent as EventListener);
    }

    return () => {
      for (const eventType of exportEventTypes) {
        source.removeEventListener(eventType, handleEvent as EventListener);
      }

      source.close();
      setSseConnectionState("closed");
    };
  }, [appendEvent, currentJobId, projectId, setSseConnectionState, upsertJob]);

  if (!hydrated) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
      <EditorHeader
        exportError={exportError}
        exportState={exportState}
        inspectorOpen={inspectorOpen}
        lastSavedAt={lastSavedAt}
        projectId={project.projectId}
        saveError={saveError}
        saveState={saveState}
        onOpenMobileInspector={() => setMobileInspectorOpen(true)}
        onSave={() => {
          void saveCurrentProject("manual-save");
        }}
        onStartExport={() => {
          void createExportRequest();
        }}
        onToggleInspector={() => setPanel("inspectorOpen", !inspectorOpen)}
      />

      <div className="xl:hidden">
        <Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
          <SheetTrigger asChild>
            <Button className="w-full justify-center" variant="outline">
              <PanelRight className="size-4" />
              Open Inspector Drawer
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[92vw] max-w-none overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Inspector Drawer</SheetTitle>
              <SheetDescription>
                Mobile access to diagnostics, runtime health, and export state.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <InspectorPanel
                analysisError={analysis.error}
                analysisLoading={analysis.loading}
                analysisProvider={analysis.provider}
                exportError={exportError}
                exportState={exportState}
                projectId={project.projectId}
                saveError={saveError}
                saveState={saveState}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <EditorSidebar projectId={projectId} />

        <div className="flex min-h-0 flex-col gap-4">
          <PreviewStage
            analysisError={analysis.error}
            analysisLoading={analysis.loading}
            analysisProvider={analysis.provider}
            analysisSnapshot={analysis.snapshot}
          />
          <TimelinePanel
            analysisError={analysis.error}
            analysisLoading={analysis.loading}
            analysisProvider={analysis.provider}
          />
        </div>

        <InspectorPanel
          analysisError={analysis.error}
          analysisLoading={analysis.loading}
          analysisProvider={analysis.provider}
          className={inspectorOpen ? "hidden xl:flex" : "hidden"}
          projectId={project.projectId}
          exportError={exportError}
          exportState={exportState}
          saveError={saveError}
          saveState={saveState}
        />
      </div>
    </main>
  );
}
