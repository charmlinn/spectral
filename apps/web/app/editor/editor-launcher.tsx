"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  Eye,
  LoaderCircle,
  MoreVertical,
  Play,
  Plus,
} from "lucide-react";

import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@spectral/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@spectral/ui/components/dialog";
import { Input } from "@spectral/ui/components/input";
import { Label } from "@spectral/ui/components/label";
import { ScrollArea } from "@spectral/ui/components/scroll-area";

import type { ProjectDetailDto } from "@/src/lib/editor-api";

type CreateProjectResponse = ProjectDetailDto;
type PresetSummary = {
  exampleUrl: string | null;
  id: string;
  name: string;
  thumbnailUrl: string | null;
};

async function listProjects(): Promise<ProjectDetailDto[]> {
  const response = await fetch("/api/projects", {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load projects with ${response.status}.`);
  }

  return response.json() as Promise<ProjectDetailDto[]>;
}

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const deltaMs = Date.now() - timestamp;
  const days = Math.max(0, Math.floor(deltaMs / 86_400_000));

  if (days === 0) {
    return "Updated today";
  }

  if (days < 7) {
    return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  }

  const weeks = Math.floor(days / 7);
  return `Updated ${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function getProjectThumbnail(project: ProjectDetailDto) {
  return (
    project.activeProject?.backdrop.source?.url ??
    project.activeProject?.visualizer.mediaSource?.url ??
    project.activeProject?.visualizer.logoSource?.url ??
    null
  );
}

async function createProject(
  name: string,
  presetId: string | null,
): Promise<CreateProjectResponse> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      presetId,
    }),
  });

  if (!response.ok) {
    let message = `Create project failed with ${response.status}.`;

    try {
      const payload = (await response.json()) as {
        error?: {
          message?: string;
        };
      };
      message = payload.error?.message ?? message;
    } catch {}

    throw new Error(message);
  }

  return response.json() as Promise<CreateProjectResponse>;
}

async function listPresets(): Promise<PresetSummary[]> {
  const response = await fetch("/api/presets", {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load presets with ${response.status}.`);
  }

  return response.json() as Promise<PresetSummary[]>;
}

export function EditorLauncher() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("Untitled Project");
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [presetLoading, setPresetLoading] = useState(true);
  const [presetId, setPresetId] = useState<string>("none");
  const [previewPreset, setPreviewPreset] = useState<PresetSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listPresets()
      .then((nextPresets) => {
        if (cancelled) {
          return;
        }

        setPresets(nextPresets);
        setPresetLoading(false);
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          requestError instanceof Error ? requestError.message : "Failed to load presets.",
        );
        setPresetLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Dialog
        open={previewPreset !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPreset(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl p-0 sm:max-w-5xl">
          {previewPreset ? (
            <>
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>{previewPreset.name}</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6">
                <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-[0_24px_90px_-40px_rgba(15,23,42,0.95)]">
                  {previewPreset.exampleUrl ? (
                    <iframe
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      className="aspect-video w-full"
                      src={previewPreset.exampleUrl}
                      title={`${previewPreset.name} preview video`}
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                      This preset does not have a preview video.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden border-white/10 bg-[#25272d] text-white shadow-2xl shadow-black/30">
        <CardHeader className="border-b border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/42">
                Templates
              </p>
              <CardTitle className="mt-2 text-2xl">Templates</CardTitle>
            </div>
            <div className="w-full sm:w-64">
              <Input
                className="border-white/10 bg-black/20 text-white placeholder:text-white/35"
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70" htmlFor="project-preset">Choose preset</Label>
            <div
              aria-label="Preset picker"
              className="rounded-lg border border-white/10 bg-black/18 p-3"
              id="project-preset"
            >
              <ScrollArea className="h-[38rem] pr-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  <button
                    className={`group rounded-lg border p-3 text-left transition ${
                      presetId === "none"
                        ? "border-red-400/70 bg-red-500/10"
                        : "border-white/10 bg-[#202228] hover:border-white/25 hover:bg-[#282b32]"
                    }`}
                    type="button"
                    onClick={() => setPresetId("none")}
                  >
                    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/20 bg-black">
                      <span className="text-sm font-medium text-white">Blank Project</span>
                    </div>
                    <div className="mt-3">
                      <p className="font-medium">Blank project</p>
                      <p className="text-xs text-white/48">Default visualizer document</p>
                    </div>
                  </button>

                  {presets.map((preset) => {
                    const selected = presetId === preset.id;

                    return (
                      <div
                        key={preset.id}
                        aria-pressed={selected}
                        className={`group cursor-pointer rounded-lg border p-3 text-left transition ${
                          selected
                            ? "border-red-400/70 bg-red-500/10"
                            : "border-white/10 bg-[#202228] hover:border-white/25 hover:bg-[#282b32]"
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPresetId(preset.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPresetId(preset.id);
                          }
                        }}
                      >
                        <div className="relative overflow-hidden rounded-md border border-white/10 bg-black">
                          {preset.thumbnailUrl ? (
                            <img
                              alt={preset.name}
                              className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              src={preset.thumbnailUrl}
                            />
                          ) : (
                            <div className="flex aspect-video items-center justify-center bg-slate-950 text-sm text-slate-300">
                              No thumbnail
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {preset.name}
                              </p>
                              <p className="text-xs text-white/70">Specterr preset</p>
                            </div>
                            <Button
                              size="sm"
                              type="button"
                              className="bg-white/90 text-black hover:bg-white"
                              variant="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewPreset(preset);
                              }}
                            >
                              <Play className="size-3.5" />
                              Preview
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {presetLoading ? (
                  <div className="flex items-center gap-2 px-1 py-4 text-sm text-white/55">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading presets...
                  </div>
                ) : null}
              </ScrollArea>
            </div>
          </div>
          <Button
            className="h-10 w-full border border-red-400/45 bg-red-500/10 text-red-200 hover:bg-red-500/18"
            disabled={
              pendingAction !== null ||
              projectName.trim().length === 0 ||
              presetLoading
            }
            onClick={async () => {
              setPendingAction("create");
              setError(null);

              try {
                const project = await createProject(
                  projectName.trim(),
                  presetId === "none" ? null : presetId,
                );
                router.push(`/editor/${project.project.id}`);
              } catch (requestError) {
                setError(
                  requestError instanceof Error ? requestError.message : "Failed to create project.",
                );
              } finally {
                setPendingAction(null);
              }
            }}
          >
            {pendingAction === "create" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create and open
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </>
  );
}

export function MyVideosPanel() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectDetailDto[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"open" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listProjects()
      .then((nextProjects) => {
        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setProjectLoading(false);
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          requestError instanceof Error ? requestError.message : "Failed to load projects.",
        );
        setProjectLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-5">
      <Card className="border-white/10 bg-[#25272d] text-white shadow-2xl shadow-black/30">
        <CardHeader className="border-b border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/42">
            My Videos
          </p>
          <CardTitle className="mt-2 text-2xl">Recent projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="min-h-[22rem] pr-3 lg:h-[calc(100vh-20rem)]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => {
                const thumbnailUrl = getProjectThumbnail(project);

                return (
                  <article
                    key={project.project.id}
                    className="overflow-hidden rounded-lg border border-white/12 bg-[#303238] shadow-xl shadow-black/20"
                  >
                    <button
                      className="block w-full text-left"
                      type="button"
                      onClick={() => router.push(`/editor/${project.project.id}`)}
                    >
                      <div className="px-4 py-3 text-center">
                        <h3 className="truncate text-xl font-semibold">
                          {project.project.name}
                        </h3>
                        <p className="text-sm text-white/48">
                          {formatRelativeDate(project.project.updatedAt)}
                        </p>
                      </div>
                      <div className="relative aspect-video bg-black">
                        {thumbnailUrl ? (
                          <img
                            alt={project.project.name}
                            className="size-full object-cover opacity-80"
                            src={thumbnailUrl}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,#090a0d,#2b2d32)]">
                            <span className="text-sm italic text-white/48">
                              No preview image
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Button
                          className="text-white/80 hover:bg-white/8 hover:text-white"
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <MoreVertical className="size-5" />
                          <span className="sr-only">Project actions</span>
                        </Button>
                        <span className="text-sm font-semibold uppercase text-red-400">
                          Draft
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          className="text-white/80 hover:bg-white/8 hover:text-white"
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => router.push(`/editor/${project.project.id}`)}
                        >
                          <Eye className="size-5" />
                          <span className="sr-only">Open project</span>
                        </Button>
                        <Button
                          className="text-white/80 hover:bg-white/8 hover:text-white"
                          disabled
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Download className="size-5" />
                          <span className="sr-only">Download export</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {projectLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/18 p-4 text-sm text-white/55">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading projects...
                </div>
              ) : null}

              {!projectLoading && projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-black/18 p-5 text-center">
                  <p className="font-medium">No videos yet</p>
                  <p className="mt-1 text-sm text-white/46">
                    Create a project from a template and it will appear here.
                  </p>
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <div className="space-y-2">
            <Label className="text-white/70" htmlFor="project-id">Open by project ID</Label>
            <Input
              className="border-white/10 bg-black/20 text-white placeholder:text-white/35"
              id="project-id"
              placeholder="Paste a persisted project UUID"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={pendingAction !== null || projectId.trim().length === 0}
            variant="outline"
            onClick={() => {
              setPendingAction("open");
              setError(null);
              router.push(`/editor/${projectId.trim()}`);
            }}
          >
            {pendingAction === "open" ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Edit video
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
