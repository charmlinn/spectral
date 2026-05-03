"use client";

import {
  AudioLines,
  Captions,
  FileVideo,
  Image,
  Layers3,
  Music2,
  SlidersHorizontal,
  Type,
  Wand2,
} from "lucide-react";

import { useEditorUiStore, useProjectStore } from "@spectral/editor-store";

import { Input } from "@spectral/ui/components/input";
import { Label } from "@spectral/ui/components/label";
import { ScrollArea } from "@spectral/ui/components/scroll-area";
import { Switch } from "@spectral/ui/components/switch";
import { Textarea } from "@spectral/ui/components/textarea";

import { AudioUploadPanel } from "./audio-upload-panel";
import { ElementsSidebar } from "./elements-sidebar";
import { GeneralSidebar } from "./general-sidebar";
import { VisualizerSidebar } from "./visualizer-sidebar";

const sections = [
  { id: "general", label: "General", icon: Music2 },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "visualizer", label: "Visualizer", icon: Wand2 },
  { id: "backdrop", label: "Backdrop", icon: Image },
  { id: "lyrics", label: "Lyrics", icon: Captions },
  { id: "text", label: "Text", icon: Type },
  { id: "elements", label: "Elements", icon: Layers3 },
  { id: "export", label: "Export", icon: FileVideo },
] as const;

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EditorSidebar({ projectId }: { projectId: string }) {
  const currentTab = useEditorUiStore((state) => state.currentTab);
  const setCurrentTab = useEditorUiStore((state) => state.setCurrentTab);
  const project = useProjectStore((state) => state.project);
  const updateAtPath = useProjectStore((state) => state.updateAtPath);
  const currentSection =
    sections.find((section) => section.id === currentTab) ?? sections[0];

  return (
    <aside className="grid min-h-0 border-r border-white/10 bg-[#202126] lg:grid-cols-[5.25rem_minmax(0,1fr)]">
      <nav className="flex gap-2 overflow-x-auto border-b border-white/10 p-3 lg:flex-col lg:overflow-x-visible lg:border-b-0 lg:border-r">
        {sections.map((section) => {
          const Icon = section.icon;
          const selected = section.id === currentTab;

          return (
            <button
              key={section.id}
              className={`flex h-16 min-w-16 flex-col items-center justify-center gap-1 rounded-md border text-[11px] font-medium transition ${
                selected
                  ? "border-red-400/45 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/58 hover:bg-white/8 hover:text-white"
              }`}
              type="button"
              onClick={() => setCurrentTab(section.id)}
            >
              <Icon className="size-5" />
              {section.label}
            </button>
          );
        })}
      </nav>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/36">
              Settings
            </p>
            <h2 className="mt-1 font-heading text-2xl font-semibold">
              {currentSection.label}
            </h2>
          </div>
          <span className="flex size-9 items-center justify-center rounded-md bg-white/8 text-white/62">
            <SlidersHorizontal className="size-4" />
          </span>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-5 py-5">
          <div className="space-y-5 pb-8 text-white">
          {currentTab === "general" ? (
            <GeneralSidebar projectId={projectId} />
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

          {currentTab === "elements" ? <ElementsSidebar /> : null}

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
      </section>
    </aside>
  );
}
