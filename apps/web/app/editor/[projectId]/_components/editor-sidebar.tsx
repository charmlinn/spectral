"use client";

import { useEditorUiStore, useProjectStore } from "@spectral/editor-store";
import { supportedAspectRatios } from "@spectral/project-schema";

import { Button } from "@spectral/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@spectral/ui/components/card";
import { Input } from "@spectral/ui/components/input";
import { Label } from "@spectral/ui/components/label";
import { ScrollArea } from "@spectral/ui/components/scroll-area";
import { Switch } from "@spectral/ui/components/switch";
import { Textarea } from "@spectral/ui/components/textarea";

import { AudioUploadPanel } from "./audio-upload-panel";
import { VisualizerSidebar } from "./visualizer-sidebar";

const sections = [
  { id: "general", label: "General" },
  { id: "audio", label: "Audio" },
  { id: "visualizer", label: "Visualizer" },
  { id: "backdrop", label: "Backdrop" },
  { id: "lyrics", label: "Lyrics" },
  { id: "text", label: "Text" },
  { id: "export", label: "Export" },
] as const;

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EditorSidebar({ projectId }: { projectId: string }) {
  const currentTab = useEditorUiStore((state) => state.currentTab);
  const setCurrentTab = useEditorUiStore((state) => state.setCurrentTab);
  const project = useProjectStore((state) => state.project);
  const setAspectRatio = useProjectStore((state) => state.setAspectRatio);
  const updateAtPath = useProjectStore((state) => state.updateAtPath);

  return (
    <Card className="flex min-h-[32rem] flex-col overflow-hidden">
      <CardHeader className="gap-2">
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Minimal editing controls now bind directly to the real project
          document in the shared store.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 px-4 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-1">
          {sections.map((section) => (
            <Button
              key={section.id}
              className="justify-start rounded-[22px]"
              size="sm"
              variant={section.id === currentTab ? "secondary" : "ghost"}
              onClick={() => setCurrentTab(section.id)}
            >
              {section.label}
            </Button>
          ))}
        </div>
      </CardContent>

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        <div className="space-y-6 pb-6">
          <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
              Project document
            </p>
            <h2 className="mt-2 font-heading text-2xl font-semibold">
              {sections.find((section) => section.id === currentTab)?.label ??
                "General"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These inputs patch the live `VideoProject` store. There is no mock
              field layer between the UI and the saved document now.
            </p>
          </div>

          {currentTab === "general" ? (
            <div className="grid gap-3">
              <div className="rounded-[20px] border border-border/70 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Canvas ratio</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Switching ratio syncs viewport, export, and preview state
                      together.
                    </p>
                  </div>
                  <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                    {project.viewport.width} x {project.viewport.height}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
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
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Project name</span>
                <Input
                  value={project.meta.name}
                  onChange={(event) =>
                    updateAtPath(["meta", "name"], event.target.value)
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Description</span>
                <Textarea
                  value={project.meta.description ?? ""}
                  onChange={(event) =>
                    updateAtPath(
                      ["meta", "description"],
                      event.target.value || null,
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Duration (ms)</span>
                <Input
                  type="number"
                  value={String(project.timing.durationMs)}
                  onChange={(event) => {
                    const nextValue = toNumber(event.target.value);
                    if (nextValue !== null && nextValue > 0) {
                      updateAtPath(["timing", "durationMs"], nextValue);
                    }
                  }}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Background color</span>
                <Input
                  type="color"
                  value={project.viewport.backgroundColor}
                  onChange={(event) =>
                    updateAtPath(
                      ["viewport", "backgroundColor"],
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          ) : null}

          {currentTab === "audio" ? (
            <div className="grid gap-3">
              <AudioUploadPanel projectId={project.projectId} />
              <label className="grid gap-2">
                <span className="text-sm font-medium">Audio asset</span>
                <Input
                  readOnly
                  value={project.audio.assetId ?? "No audio asset"}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Analysis ID</span>
                <Input
                  readOnly
                  value={project.audio.analysisId ?? "No audio analysis"}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Gain</span>
                <Input
                  type="number"
                  step="0.1"
                  value={String(project.audio.gain)}
                  onChange={(event) => {
                    const nextValue = toNumber(event.target.value);
                    if (nextValue !== null) {
                      updateAtPath(["audio", "gain"], nextValue);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}

          {currentTab === "visualizer" ? (
            <VisualizerSidebar projectId={projectId} />
          ) : null}

          {currentTab === "backdrop" ? (
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Backdrop asset</span>
                <Input
                  readOnly
                  value={
                    project.backdrop.source?.assetId ?? "No backdrop asset"
                  }
                />
              </label>
              <div className="flex items-center justify-between gap-3 rounded-[20px] border border-border/70 p-3">
                <div>
                  <Label htmlFor="backdrop-filter">Filter enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Direct store binding for backdrop filter state.
                  </p>
                </div>
                <Switch
                  checked={project.backdrop.filterEnabled}
                  id="backdrop-filter"
                  onCheckedChange={(checked) =>
                    updateAtPath(["backdrop", "filterEnabled"], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[20px] border border-border/70 p-3">
                <div>
                  <Label htmlFor="backdrop-shake">Shake enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Uses the real backdrop config instead of placeholder
                    toggles.
                  </p>
                </div>
                <Switch
                  checked={project.backdrop.shakeEnabled}
                  id="backdrop-shake"
                  onCheckedChange={(checked) =>
                    updateAtPath(["backdrop", "shakeEnabled"], checked)
                  }
                />
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Padding factor</span>
                <Input
                  id="backdrop-padding-factor"
                  type="number"
                  value={String(project.backdrop.paddingFactor)}
                  onChange={(event) => {
                    const value = toNumber(event.target.value);

                    if (value !== null) {
                      updateAtPath(["backdrop", "paddingFactor"], value);
                    }
                  }}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Shake factor</span>
                <Input
                  id="backdrop-shake-factor"
                  type="number"
                  value={String(project.backdrop.shakeFactor)}
                  onChange={(event) => {
                    const value = toNumber(event.target.value);

                    if (value !== null) {
                      updateAtPath(["backdrop", "shakeFactor"], value);
                    }
                  }}
                />
              </label>
              <div className="grid gap-3 rounded-[20px] border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="backdrop-bounce">Bounce enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      Audio-reactive scaling copied from Specterr backdrop media.
                    </p>
                  </div>
                  <Switch
                    checked={project.backdrop.bounceEnabled}
                    id="backdrop-bounce"
                    onCheckedChange={(checked) =>
                      updateAtPath(["backdrop", "bounceEnabled"], checked)
                    }
                  />
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Bounce scale</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.bounceScale)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "bounceScale"], value);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="grid gap-3 rounded-[20px] border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="backdrop-vignette">Vignette enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      Darkens the frame edges based on audio level.
                    </p>
                  </div>
                  <Switch
                    checked={project.backdrop.vignetteEnabled}
                    id="backdrop-vignette"
                    onCheckedChange={(checked) =>
                      updateAtPath(["backdrop", "vignetteEnabled"], checked)
                    }
                  />
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Vignette factor</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.vignetteFactor)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "vignetteFactor"], value);
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Max vignette</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.maxVignette)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "maxVignette"], value);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="grid gap-3 rounded-[20px] border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="backdrop-contrast">Contrast enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      Audio-reactive contrast boost for backdrop media.
                    </p>
                  </div>
                  <Switch
                    checked={project.backdrop.contrastEnabled}
                    id="backdrop-contrast"
                    onCheckedChange={(checked) =>
                      updateAtPath(["backdrop", "contrastEnabled"], checked)
                    }
                  />
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Contrast factor</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.contrastFactor)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "contrastFactor"], value);
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Max contrast</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.maxContrast)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "maxContrast"], value);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="grid gap-3 rounded-[20px] border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="backdrop-zoom-blur">
                      Zoom blur enabled
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Adds audio-reactive radial blur passes on the backdrop.
                    </p>
                  </div>
                  <Switch
                    checked={project.backdrop.zoomBlurEnabled}
                    id="backdrop-zoom-blur"
                    onCheckedChange={(checked) =>
                      updateAtPath(["backdrop", "zoomBlurEnabled"], checked)
                    }
                  />
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Zoom blur factor</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.zoomBlurFactor)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "zoomBlurFactor"], value);
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Max zoom blur</span>
                  <Input
                    type="number"
                    value={String(project.backdrop.maxZoomBlur)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        updateAtPath(["backdrop", "maxZoomBlur"], value);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {currentTab === "lyrics" ? (
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Segment count</span>
                <Input
                  readOnly
                  value={String(project.lyrics.segments.length)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  Current lyric style text
                </span>
                <Textarea
                  value={project.lyrics.style.text}
                  onChange={(event) =>
                    updateAtPath(
                      ["lyrics", "style", "text"],
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  First visible segment preview
                </span>
                <Textarea
                  readOnly
                  value={
                    project.lyrics.segments
                      .slice(0, 5)
                      .map((segment) => segment.text)
                      .join("\n") || "No lyric segments"
                  }
                />
              </label>
            </div>
          ) : null}

          {currentTab === "text" ? (
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Text layers</span>
                <Input readOnly value={String(project.textLayers.length)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  Primary text preview
                </span>
                <Textarea
                  readOnly
                  value={
                    project.textLayers[0]?.style.text ??
                    "No text layer configured"
                  }
                />
              </label>
            </div>
          ) : null}

          {currentTab === "export" ? (
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Format</span>
                <Input
                  value={project.export.format}
                  onChange={(event) =>
                    updateAtPath(["export", "format"], event.target.value)
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Width</span>
                <Input
                  type="number"
                  value={String(project.export.width)}
                  onChange={(event) => {
                    const nextValue = toNumber(event.target.value);
                    if (nextValue !== null && nextValue > 0) {
                      updateAtPath(["export", "width"], nextValue);
                    }
                  }}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Height</span>
                <Input
                  type="number"
                  value={String(project.export.height)}
                  onChange={(event) => {
                    const nextValue = toNumber(event.target.value);
                    if (nextValue !== null && nextValue > 0) {
                      updateAtPath(["export", "height"], nextValue);
                    }
                  }}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">FPS</span>
                <Input
                  type="number"
                  value={String(project.export.fps)}
                  onChange={(event) => {
                    const nextValue = toNumber(event.target.value);
                    if (nextValue !== null && nextValue > 0) {
                      updateAtPath(["export", "fps"], nextValue);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </Card>
  );
}
