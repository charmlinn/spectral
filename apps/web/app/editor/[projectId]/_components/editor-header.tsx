"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileJson,
  LoaderCircle,
  MoreHorizontal,
  PanelRight,
  Rocket,
  Save,
} from "lucide-react";

import { useExportStore, useProjectStore } from "@spectral/editor-store";
import { supportedAspectRatios } from "@spectral/project-schema";
import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import { Card } from "@spectral/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spectral/ui/components/dropdown-menu";

type EditorHeaderProps = {
  exportError: string | null;
  exportState: "idle" | "creating" | "error";
  inspectorOpen: boolean;
  lastSavedAt: string | null;
  projectId: string;
  saveError: string | null;
  saveState: "idle" | "saving" | "saved" | "error";
  onDownloadMockJson: () => void;
  onOpenMobileInspector: () => void;
  onSave: () => void;
  onStartExport: () => void;
  onToggleInspector: () => void;
};

export function EditorHeader({
  exportError,
  exportState,
  inspectorOpen,
  lastSavedAt,
  projectId,
  saveError,
  saveState,
  onDownloadMockJson,
  onOpenMobileInspector,
  onSave,
  onStartExport,
  onToggleInspector,
}: EditorHeaderProps) {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const setAspectRatio = useProjectStore((state) => state.setAspectRatio);
  const snapshotVersion = useProjectStore((state) => state.snapshotVersion);
  const currentJobId = useExportStore((state) => state.currentJobId);

  const formattedSaveTime = lastSavedAt
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
      }).format(new Date(lastSavedAt))
    : "Not saved yet";

  const saveStatusLabel =
    saveState === "saving"
      ? "Saving"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : dirty
            ? "Unsaved"
            : "Synced";

  return (
    <Card className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/editor">
                <ArrowLeft className="size-4" />
                Projects
              </Link>
            </Button>
            <Badge
              variant={saveState === "error" ? "destructive" : "secondary"}
            >
              {saveStatusLabel}
            </Badge>
            <Badge variant="outline">
              {project.viewport.width} x {project.viewport.height}
            </Badge>
            <Badge variant="outline">{project.viewport.aspectRatio}</Badge>
            <Badge variant="outline">
              {project.export.format.toUpperCase()}
            </Badge>
            {snapshotVersion ? (
              <Badge variant="outline">
                Snapshot {snapshotVersion.slice(0, 8)}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Canvas ratio
            </span>
            {supportedAspectRatios.map((aspectRatio) => (
              <Button
                key={aspectRatio}
                size="sm"
                variant={
                  project.viewport.aspectRatio === aspectRatio
                    ? "secondary"
                    : "outline"
                }
                onClick={() => setAspectRatio(aspectRatio)}
              >
                {aspectRatio}
              </Button>
            ))}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-3xl font-semibold tracking-tight">
              {project.meta.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Project ID: {projectId} · Last checkpoint {formattedSaveTime}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onSave}>
            {saveState === "saving" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save draft
          </Button>
          <Button size="sm" variant="outline" onClick={onDownloadMockJson}>
            <FileJson className="size-4" />
            Mock JSON
          </Button>
          <Button
            disabled={exportState === "creating"}
            size="sm"
            onClick={onStartExport}
          >
            {exportState === "creating" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            Export
          </Button>
          <Button
            className="xl:hidden"
            size="icon"
            variant="outline"
            onClick={onOpenMobileInspector}
          >
            <PanelRight className="size-4" />
            <span className="sr-only">Open mobile inspector</span>
          </Button>
          <Button
            aria-pressed={inspectorOpen}
            className="hidden xl:inline-flex"
            size="icon"
            variant={inspectorOpen ? "secondary" : "outline"}
            onClick={onToggleInspector}
          >
            <PanelRight className="size-4" />
            <span className="sr-only">Toggle inspector</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open project actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSave}>
                Save current snapshot
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDownloadMockJson}>
                Download mock JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onStartExport}>
                Create export job
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!currentJobId}>
                Current export: {currentJobId?.slice(0, 8) ?? "none"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                No destructive shell actions wired
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {saveError ? (
        <p className="text-sm text-destructive">{saveError}</p>
      ) : null}
      {exportError ? (
        <p className="text-sm text-destructive">{exportError}</p>
      ) : null}
    </Card>
  );
}
