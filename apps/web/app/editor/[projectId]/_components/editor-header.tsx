"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CopyPlus,
  FileJson,
  LoaderCircle,
  MoreHorizontal,
  Rocket,
  Save,
} from "lucide-react";

import { useExportStore, useProjectStore } from "@spectral/editor-store";
import { supportedAspectRatios } from "@spectral/project-schema";
import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
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
  lastSavedAt: string | null;
  projectId: string;
  saveError: string | null;
  saveState: "idle" | "saving" | "saved" | "error";
  onDownloadMockJson: () => void;
  onSave: () => void;
  onStartExport: () => void;
};

export function EditorHeader({
  exportError,
  exportState,
  lastSavedAt,
  projectId,
  saveError,
  saveState,
  onDownloadMockJson,
  onSave,
  onStartExport,
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
    <header className="flex min-h-16 flex-col gap-3 border-b border-white/10 bg-[#2b2d32] px-4 py-3 text-white lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Button asChild className="text-white/78 hover:bg-white/8 hover:text-white" size="icon" variant="ghost">
          <Link href="/">
            <ArrowLeft className="size-5" />
            <span className="sr-only">Back to templates</span>
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-heading text-lg font-semibold">
              {project.meta.name}
            </h1>
            <Badge
              className="border-white/10 bg-white/8 text-white/70"
              variant={saveState === "error" ? "destructive" : "outline"}
            >
              {saveStatusLabel}
            </Badge>
          </div>
          <p className="truncate text-xs text-white/42">
            {projectId} · Saved {formattedSaveTime}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/18 p-1">
          {supportedAspectRatios.map((aspectRatio) => (
            <Button
              key={aspectRatio}
              className={
                project.viewport.aspectRatio === aspectRatio
                  ? "bg-white/18 text-white hover:bg-white/22"
                  : "text-white/55 hover:bg-white/8 hover:text-white"
              }
              size="sm"
              variant="ghost"
              onClick={() => setAspectRatio(aspectRatio)}
            >
              {aspectRatio}
            </Button>
          ))}
        </div>

        <div className="hidden items-center gap-2 text-xs text-white/46 md:flex">
          <span>{project.viewport.width} x {project.viewport.height}</span>
          <span>{project.export.format.toUpperCase()}</span>
          {snapshotVersion ? <span>Snapshot {snapshotVersion.slice(0, 8)}</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <Button className="border-white/12 bg-white/8 text-white hover:bg-white/12" size="sm" variant="outline" onClick={onSave}>
            {saveState === "saving" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
          <Button className="border-white/12 bg-white/8 text-white hover:bg-white/12" size="sm" variant="outline" onClick={onDownloadMockJson}>
            <FileJson className="size-4" />
            Mock JSON
          </Button>
          <Button
            className="border border-red-400/45 bg-red-500/10 text-red-200 hover:bg-red-500/18"
            disabled={exportState === "creating"}
            size="sm"
            onClick={onStartExport}
          >
            {exportState === "creating" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            Export Video
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="border-white/12 bg-white/8 text-white hover:bg-white/12" size="icon" variant="outline">
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
              <DropdownMenuItem disabled>
                <CopyPlus className="size-4" />
                Duplicate project
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
    </header>
  );
}
