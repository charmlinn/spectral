"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Play, Plus } from "lucide-react";

import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [presetLoading, setPresetLoading] = useState(true);
  const [presetId, setPresetId] = useState<string>("none");
  const [previewPreset, setPreviewPreset] = useState<PresetSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "open" | null>(null);
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
                <DialogDescription>
                  Specterr preset preview from the imported `exampleUrl`.
                </DialogDescription>
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

      <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create Project</CardTitle>
          <CardDescription>
            Create a persisted project from either a blank document or an imported Specterr preset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-preset">Preset</Label>
            <div
              aria-label="Preset picker"
              className="rounded-[24px] border border-border/70 bg-muted/25 p-3"
              id="project-preset"
            >
              <ScrollArea className="h-[26rem] pr-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className={`group rounded-[22px] border p-3 text-left transition ${
                      presetId === "none"
                        ? "border-primary bg-primary/8 shadow-[0_0_0_1px_rgba(var(--primary),0.15)]"
                        : "border-border/70 bg-background/80 hover:border-primary/40 hover:bg-background"
                    }`}
                    type="button"
                    onClick={() => setPresetId("none")}
                  >
                    <div className="flex aspect-video items-center justify-center rounded-[18px] border border-dashed border-border/80 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_45%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,1))]">
                      <span className="text-sm font-medium text-white">Blank Project</span>
                    </div>
                    <div className="mt-3">
                      <p className="font-medium">Blank project</p>
                      <p className="text-xs text-muted-foreground">
                        Start from the default Specterr-compatible document.
                      </p>
                    </div>
                  </button>

                  {presets.map((preset) => {
                    const selected = presetId === preset.id;

                    return (
                      <div
                        key={preset.id}
                        aria-pressed={selected}
                        className={`group cursor-pointer rounded-[22px] border p-3 text-left transition ${
                          selected
                            ? "border-primary bg-primary/8 shadow-[0_0_0_1px_rgba(var(--primary),0.15)]"
                            : "border-border/70 bg-background/80 hover:border-primary/40 hover:bg-background"
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
                        <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-slate-950">
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
                  <div className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading presets...
                  </div>
                ) : null}
              </ScrollArea>
            </div>
          </div>
          <Button
            className="w-full"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Existing Project</CardTitle>
          <CardDescription>Fail fast on missing IDs instead of using demo entries or fallback mock data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID</Label>
            <Input
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
            Open editor
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
