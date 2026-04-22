"use client";

import type { HTMLAttributes } from "react";

import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import {
  useExportStore,
  usePreviewStore,
  useProjectStore,
} from "@spectral/editor-store";
import { cn } from "@spectral/ui/lib/utils";

import { Badge } from "@spectral/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@spectral/ui/components/card";
import { Separator } from "@spectral/ui/components/separator";

type InspectorPanelProps = HTMLAttributes<HTMLDivElement> & {
  analysisError: string | null;
  analysisLoading: boolean;
  analysisProvider: AudioAnalysisProvider | null;
  exportError: string | null;
  exportState: "idle" | "creating" | "error";
  projectId: string;
  saveError: string | null;
  saveState: "idle" | "saving" | "saved" | "error";
};

export function InspectorPanel({
  analysisError,
  analysisLoading,
  analysisProvider,
  className,
  exportError,
  exportState,
  projectId,
  saveError,
  saveState,
  ...props
}: InspectorPanelProps) {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const snapshotVersion = useProjectStore((state) => state.snapshotVersion);
  const runtimeHealth = usePreviewStore((state) => state.runtimeHealth);
  const surfaceWidth = usePreviewStore((state) => state.surfaceWidth);
  const surfaceHeight = usePreviewStore((state) => state.surfaceHeight);
  const viewportWidth = usePreviewStore((state) => state.viewportWidth);
  const viewportHeight = usePreviewStore((state) => state.viewportHeight);
  const jobs = useExportStore((state) => state.jobs);
  const currentJobId = useExportStore((state) => state.currentJobId);
  const sseConnectionState = useExportStore(
    (state) => state.sseConnectionState,
  );
  const eventsByJobId = useExportStore((state) => state.eventsByJobId);
  const currentJob = jobs.find((job) => job.id === currentJobId) ?? null;
  const currentEvents = currentJobId ? (eventsByJobId[currentJobId] ?? []) : [];

  return (
    <div className={cn("min-h-0 flex-col gap-4", className)} {...props}>
      <Card className="flex min-h-[32rem] flex-col">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Inspector</CardTitle>
            <Badge variant="outline">{runtimeHealth}</Badge>
          </div>
          <CardDescription>
            Runtime health, persistence status, and export telemetry from the
            real editor chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
            <p className="text-sm font-medium">Project state</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Dirty {dirty ? "yes" : "no"} · Snapshot{" "}
              {snapshotVersion ? snapshotVersion.slice(0, 8) : "missing"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Viewport {viewportWidth} x {viewportHeight} · Surface{" "}
              {Math.round(surfaceWidth)} x {Math.round(surfaceHeight)} · Export
              preset {project.export.width} x {project.export.height} /{" "}
              {project.export.fps}fps
            </p>
          </div>

          <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/60 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Persistence</p>
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                {saveState}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Manual save and autosave both call the real project snapshot API.
            </p>
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/60 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Audio analysis</p>
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                {analysisProvider
                  ? "ready"
                  : analysisLoading
                    ? "loading"
                    : "missing"}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Analysis ID {project.audio.analysisId ?? "none"} · Audio asset{" "}
              {project.audio.assetId ?? "none"}
            </p>
            {analysisError ? (
              <p className="text-sm text-amber-600">{analysisError}</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/60 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Export stream</p>
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                {exportState} · SSE {sseConnectionState}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Jobs {jobs.length} · Current{" "}
              {currentJobId ? currentJobId.slice(0, 8) : "none"} · Latest
              progress {currentJob ? `${currentJob.progress}%` : "n/a"}
            </p>
            {exportError ? (
              <p className="text-sm text-destructive">{exportError}</p>
            ) : null}
          </div>

          {currentEvents.length > 0 ? (
            <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/60 p-4">
              <p className="text-sm font-medium">Recent export events</p>
              {currentEvents.slice(-5).map((event, index) => (
                <div key={`${event.jobId}-${event.id}`} className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">
                    {event.type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {event.createdAt}
                  </p>
                  {index < currentEvents.slice(-5).length - 1 ? (
                    <Separator className="bg-border/60" />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-[24px] border border-dashed border-border p-4 text-sm text-muted-foreground">
            Inspector mount key:{" "}
            <span className="font-medium text-foreground">{projectId}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
