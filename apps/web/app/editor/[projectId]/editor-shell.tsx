"use client";

import { useEffect, useEffectEvent, useState } from "react";

import {
  useEditorUiStore,
  useExportStore,
  usePlaybackStore,
  usePreviewStore,
  useProjectStore,
} from "@spectral/editor-store";

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
import { PreviewStage } from "./_components/preview-stage";
import { TimelinePanel } from "./_components/timeline-panel";

type EditorShellProps = {
  projectId: string;
  initialProjectDetail: ProjectDetailDto;
  initialExportJobs: ExportJobDto[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
type ExportState = "idle" | "creating" | "error";

const TEMP_HIDE_TIMELINE_PANEL = true;
const MOCK_EXPORT_DURATION_MS = 15_000;

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

function createMockExportProjectJson() {
  const project = structuredClone(useProjectStore.getState().project);

  project.timing.durationMs = MOCK_EXPORT_DURATION_MS;
  project.updatedAt = new Date().toISOString();

  if (
    project.audio.trimEndMs === null ||
    project.audio.trimEndMs > MOCK_EXPORT_DURATION_MS
  ) {
    project.audio.trimEndMs = MOCK_EXPORT_DURATION_MS;
  }

  return project;
}

function downloadJsonFile(input: { filename: string; payload: unknown }) {
  const blob = new Blob([`${JSON.stringify(input.payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = input.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function EditorShell({
  projectId,
  initialProjectDetail,
  initialExportJobs,
}: EditorShellProps) {
  const [hydrated, setHydrated] = useState(false);
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

  const downloadMockExportJson = useEffectEvent(() => {
    const payload = createMockExportProjectJson();

    downloadJsonFile({
      filename: `spectral-${projectId}-mock-15s.json`,
      payload,
    });
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
    <main className="flex h-screen min-h-[720px] w-full flex-col overflow-hidden bg-[#1b1d21] text-white">
      <EditorHeader
        exportError={exportError}
        exportState={exportState}
        lastSavedAt={lastSavedAt}
        projectId={project.projectId}
        saveError={saveError}
        saveState={saveState}
        onSave={() => {
          void saveCurrentProject("manual-save");
        }}
        onDownloadMockJson={() => {
          downloadMockExportJson();
        }}
        onStartExport={() => {
          void createExportRequest();
        }}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[27rem_minmax(0,1fr)]">
        <EditorSidebar projectId={projectId} />

        <div className="flex min-h-0 flex-col">
          <PreviewStage
            analysisError={analysis.error}
            analysisLoading={analysis.loading}
            analysisProvider={analysis.provider}
            analysisSnapshot={analysis.snapshot}
          />
          {TEMP_HIDE_TIMELINE_PANEL ? null : (
            <TimelinePanel
              analysisError={analysis.error}
              analysisLoading={analysis.loading}
              analysisProvider={analysis.provider}
            />
          )}
        </div>
      </div>
    </main>
  );
}
