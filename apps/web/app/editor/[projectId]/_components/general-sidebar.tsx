"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare2, ChevronRight, ImagePlus, Layers3 } from "lucide-react";

import {
  useEditorUiStore,
  useProjectStore,
} from "@spectral/editor-store";
import type { VideoProject } from "@spectral/project-schema";
import { Button } from "@spectral/ui/components/button";
import { Input } from "@spectral/ui/components/input";
import { Label } from "@spectral/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spectral/ui/components/select";
import { Switch } from "@spectral/ui/components/switch";
import { Textarea } from "@spectral/ui/components/textarea";

import {
  completeAsset,
  createAssetUploadUrl,
  getPreset,
  listPresets,
  uploadFileToSignedUrl,
  type PresetSummaryDto,
} from "@/src/lib/editor-api";

import { AudioUploadPanel } from "./audio-upload-panel";
import { ElementsSidebar } from "./elements-sidebar";

type GeneralSidebarProps = {
  projectId: string;
};

type GeneralStepId =
  | "preset"
  | "audio"
  | "images"
  | "text"
  | "colors"
  | "elements"
  | "export";

const GENERAL_STEPS: Array<{ id: GeneralStepId; label: string }> = [
  { id: "preset", label: "Preset" },
  { id: "audio", label: "Audio" },
  { id: "images", label: "Images" },
  { id: "text", label: "Text" },
  { id: "colors", label: "Colors" },
  { id: "elements", label: "Elements" },
  { id: "export", label: "Export" },
];

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColorForInput(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "#ffffff";
  }

  if (normalized.startsWith("#")) {
    return normalized.length === 7 ? normalized : "#ffffff";
  }

  if (normalized.startsWith("0x") && normalized.length === 8) {
    return `#${normalized.slice(2)}`;
  }

  return "#ffffff";
}

function toHexColor(value: string) {
  return `0x${value.replace("#", "").toLowerCase()}`;
}

async function measureVisualFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    if (file.type.startsWith("video/")) {
      return await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };
        video.onerror = () => reject(new Error("Failed to read video dimensions."));
        video.src = objectUrl;
      });
    }

    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => reject(new Error("Failed to read image dimensions."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createDefaultTextLayer(index: number): VideoProject["textLayers"][number] {
  return {
    id: `text-${index + 1}`,
    visible: true,
    startMs: 0,
    endMs: null,
    style: {
      text: "",
      color: "#ffffff",
      anchorPoint: "center",
      font: "Montserrat",
      fontSize: 48,
      bold: false,
      shadow: {
        enabled: false,
        color: "#000000",
        blur: 0,
        opacity: 1,
      },
      position: {
        x: 0,
        y: 0,
      },
      drift: {
        enabled: false,
        intensity: 0,
        customMode: false,
        amplitudeX: 0,
        amplitudeY: 0,
        rotation: 0,
        speed: 0,
        octaves: 1,
        scale: 1,
        acceleration: 0,
      },
    },
  };
}

function ToggleField({
  checked,
  label,
  description,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  description?: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-border/60 p-3">
      <div>
        <Label>{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function GeneralSidebar({ projectId }: GeneralSidebarProps) {
  const project = useProjectStore((state) => state.project);
  const applyPatch = useProjectStore((state) => state.applyPatch);
  const updateAtPath = useProjectStore((state) => state.updateAtPath);
  const setCurrentTab = useEditorUiStore((state) => state.setCurrentTab);

  const [stepGuideEnabled, setStepGuideEnabled] = useState(true);
  const [activeStepId, setActiveStepId] = useState<GeneralStepId>("images");
  const [presets, setPresets] = useState<PresetSummaryDto[]>([]);
  const [presetLoading, setPresetLoading] = useState(true);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(
    project.meta.presetId ?? "none",
  );
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<"logo" | "background" | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedPresetId(project.meta.presetId ?? "none");
  }, [project.meta.presetId]);

  useEffect(() => {
    let cancelled = false;

    setPresetLoading(true);
    setPresetError(null);

    void listPresets()
      .then((nextPresets) => {
        if (cancelled) {
          return;
        }

        setPresets(nextPresets);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPresetError(
          error instanceof Error ? error.message : "Failed to load presets.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setPresetLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const reversedWaveLayers = useMemo(
    () => [...project.visualizer.waveCircles].reverse(),
    [project.visualizer.waveCircles],
  );

  async function uploadVisualAsset(
    file: File,
    target: "logo" | "background",
  ) {
    setUploadError(null);
    setUploadingTarget(target);

    try {
      const kind =
        target === "background"
          ? file.type.startsWith("video/")
            ? "video"
            : "image"
          : "logo";
      const dimensions = await measureVisualFile(file);
      const uploadPlan = await createAssetUploadUrl({
        projectId,
        kind,
        contentType: file.type || (target === "background" ? "image/png" : "image/png"),
        originalFilename: file.name,
      });

      await uploadFileToSignedUrl(uploadPlan.upload, file);
      const asset = await completeAsset({
        assetId: uploadPlan.asset.id,
        byteSize: file.size,
        width: dimensions.width,
        height: dimensions.height,
      });

      const nextSource =
        target === "background"
          ? {
              assetId: asset.id,
              storageKey: asset.storageKey,
              url: asset.resolvedUrl,
              kind: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
              origin: "upload" as const,
              mimeType: asset.mimeType,
            }
          : {
              assetId: asset.id,
              storageKey: asset.storageKey,
              url: asset.resolvedUrl,
              kind: "logo" as const,
              origin: "upload" as const,
              mimeType: asset.mimeType,
            };

      if (target === "background") {
        updateAtPath(["backdrop", "source"], nextSource);
      } else {
        applyPatch((currentProject) => ({
          ...currentProject,
          visualizer: {
            ...currentProject.visualizer,
            logoVisible: true,
            logoSource: nextSource,
            mediaSource: nextSource,
          },
        }));
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload media.",
      );
    } finally {
      setUploadingTarget(null);
    }
  }

  async function applySelectedPreset() {
    if (selectedPresetId === "none") {
      return;
    }

    setApplyingPreset(true);
    setPresetError(null);

    try {
      const preset = await getPreset(selectedPresetId);

      applyPatch((currentProject) => ({
        ...preset.projectData,
        projectId: currentProject.projectId,
        createdAt: currentProject.createdAt,
        updatedAt: currentProject.updatedAt,
      }));
    } catch (error) {
      setPresetError(
        error instanceof Error ? error.message : "Failed to apply preset.",
      );
    } finally {
      setApplyingPreset(false);
    }
  }

  function addTextLayer() {
    applyPatch((currentProject) => ({
      ...currentProject,
      textLayers: [
        ...currentProject.textLayers,
        createDefaultTextLayer(currentProject.textLayers.length),
      ].slice(0, 7),
    }));
  }

  function removeTextLayer(index: number) {
    applyPatch((currentProject) => ({
      ...currentProject,
      textLayers: currentProject.textLayers.filter(
        (_, layerIndex) => layerIndex !== index,
      ),
    }));
  }

  const imagesStep = (
    <div className="grid gap-3">
      <input
        ref={logoInputRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (file) {
            void uploadVisualAsset(file, "logo");
          }
        }}
      />
      <input
        ref={backgroundInputRef}
        accept="image/*,video/*"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (file) {
            void uploadVisualAsset(file, "background");
          }
        }}
      />
      <div className="flex items-center justify-between rounded-[16px] border border-border/60 p-3">
        <div>
          <Label>Logo</Label>
          <p className="text-xs text-muted-foreground">
            {project.visualizer.logoSource?.assetId ??
              project.visualizer.logoSource?.url ??
              "No logo media"}
          </p>
        </div>
        <Button
          disabled={uploadingTarget !== null}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => logoInputRef.current?.click()}
        >
          <ImagePlus className="mr-2 size-4" />
          {uploadingTarget === "logo" ? "Uploading..." : "Select Media"}
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-[16px] border border-border/60 p-3">
        <div>
          <Label>Background</Label>
          <p className="text-xs text-muted-foreground">
            {project.backdrop.source?.assetId ??
              project.backdrop.source?.url ??
              "No background media"}
          </p>
        </div>
        <Button
          disabled={uploadingTarget !== null}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => backgroundInputRef.current?.click()}
        >
          <ImagePlus className="mr-2 size-4" />
          {uploadingTarget === "background" ? "Uploading..." : "Select Media"}
        </Button>
      </div>
      <ToggleField
        checked={project.backdrop.reflection.type !== "none"}
        label="Mirror Background"
        onCheckedChange={(checked) =>
          updateAtPath(["backdrop", "reflection"], {
            type: checked ? "two-way" : "none",
            direction:
              project.backdrop.reflection.direction === "down"
                ? "right"
                : project.backdrop.reflection.direction,
          })
        }
      />
      {uploadError ? (
        <p className="text-sm text-destructive">{uploadError}</p>
      ) : null}
    </div>
  );

  const stepContent: Record<GeneralStepId, React.ReactNode> = {
    preset: (
      <div className="grid gap-3">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Preset</span>
          <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
            <SelectTrigger>
              <SelectValue placeholder="Blank project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Blank project</SelectItem>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          disabled={presetLoading || applyingPreset || selectedPresetId === "none"}
          type="button"
          variant="outline"
          onClick={() => void applySelectedPreset()}
        >
          <Layers3 className="mr-2 size-4" />
          {applyingPreset ? "Applying..." : "Apply Preset"}
        </Button>
        {presetError ? <p className="text-sm text-destructive">{presetError}</p> : null}
      </div>
    ),
    audio: <AudioUploadPanel projectId={projectId} />,
    images: imagesStep,
    text: (
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Text Layers</p>
          <Button
            disabled={project.textLayers.length >= 7}
            size="sm"
            type="button"
            variant="outline"
            onClick={addTextLayer}
          >
            Add Text
          </Button>
        </div>
        {project.textLayers.map((layer, index) => (
          <div
            key={layer.id || `text-layer-${index}`}
            className="grid gap-3 rounded-[16px] border border-border/60 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Text {index + 1}</p>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => removeTextLayer(index)}
              >
                Remove
              </Button>
            </div>
            <ToggleField
              checked={layer.visible}
              label="Visible"
              onCheckedChange={(checked) =>
                applyPatch((currentProject) => ({
                  ...currentProject,
                  textLayers: currentProject.textLayers.map((textLayer, layerIndex) =>
                    layerIndex === index
                      ? {
                          ...textLayer,
                          visible: checked,
                        }
                      : textLayer,
                  ),
                }))
              }
            />
            <Textarea
              value={layer.style.text}
              onChange={(event) =>
                applyPatch((currentProject) => ({
                  ...currentProject,
                  textLayers: currentProject.textLayers.map((textLayer, layerIndex) =>
                    layerIndex === index
                      ? {
                          ...textLayer,
                          style: {
                            ...textLayer.style,
                            text: event.target.value,
                          },
                        }
                      : textLayer,
                  ),
                }))
              }
            />
          </div>
        ))}
        <div className="flex items-center justify-between rounded-[16px] border border-border/60 p-3">
          <div>
            <Label>Lyrics</Label>
            <p className="text-xs text-muted-foreground">
              {project.lyrics.segments.length} segments
            </p>
          </div>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setCurrentTab("lyrics")}
          >
            Open Lyrics
          </Button>
        </div>
      </div>
    ),
    colors: (
      <div className="grid gap-3">
        {reversedWaveLayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wave layers yet. Open Visualizer to add them.
          </p>
        ) : (
          reversedWaveLayers.map((layer, reversedIndex) => {
            const index = project.visualizer.waveCircles.length - reversedIndex - 1;

            return (
              <div
                key={`wave-layer-${index}`}
                className="grid gap-3 rounded-[16px] border border-border/60 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    Wave Layer {project.visualizer.waveCircles.length - index}
                  </p>
                  <Switch
                    checked={layer.visible}
                    onCheckedChange={(checked) =>
                      applyPatch((currentProject) => ({
                        ...currentProject,
                        visualizer: {
                          ...currentProject.visualizer,
                          waveCircles: currentProject.visualizer.waveCircles.map(
                            (waveLayer, layerIndex) =>
                              layerIndex === index
                                ? {
                                    ...waveLayer,
                                    visible: checked,
                                  }
                                : waveLayer,
                          ),
                        },
                      }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Fill color</span>
                    <Input
                      type="color"
                      value={normalizeColorForInput(layer.fillColor)}
                      onChange={(event) =>
                        applyPatch((currentProject) => ({
                          ...currentProject,
                          visualizer: {
                            ...currentProject.visualizer,
                            waveCircles: currentProject.visualizer.waveCircles.map(
                              (waveLayer, layerIndex) =>
                                layerIndex === index
                                  ? {
                                      ...waveLayer,
                                      fillColor: toHexColor(event.target.value),
                                    }
                                  : waveLayer,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Line color</span>
                    <Input
                      type="color"
                      value={normalizeColorForInput(layer.lineColor)}
                      onChange={(event) =>
                        applyPatch((currentProject) => ({
                          ...currentProject,
                          visualizer: {
                            ...currentProject.visualizer,
                            waveCircles: currentProject.visualizer.waveCircles.map(
                              (waveLayer, layerIndex) =>
                                layerIndex === index
                                  ? {
                                      ...waveLayer,
                                      lineColor: toHexColor(event.target.value),
                                    }
                                  : waveLayer,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentTab("visualizer")}
        >
          Open Full Visualizer Controls
        </Button>
      </div>
    ),
    elements: <ElementsSidebar />,
    export: (
      <div className="grid gap-3">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Format</span>
          <Select
            value={project.export.format}
            onValueChange={(value) => updateAtPath(["export", "format"], value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp4">MP4</SelectItem>
              <SelectItem value="mov">MOV</SelectItem>
              <SelectItem value="webm">WEBM</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Width</span>
            <Input
              type="number"
              value={String(project.export.width)}
              onChange={(event) => {
                const value = toNumber(event.target.value);

                if (value !== null) {
                  updateAtPath(["export", "width"], value);
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
                const value = toNumber(event.target.value);

                if (value !== null) {
                  updateAtPath(["export", "height"], value);
                }
              }}
            />
          </label>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentTab("export")}
        >
          Open Export Section
        </Button>
      </div>
    ),
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-[20px] border border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">General</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Restore the Specterr step guide flow for preset, audio, images, text,
              colors, elements, and export.
            </p>
          </div>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setStepGuideEnabled((value) => !value)}
          >
            <CheckSquare2 className="mr-2 size-4" />
            Step Guide
          </Button>
        </div>
      </div>

      {stepGuideEnabled ? (
        <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="grid gap-2">
            {GENERAL_STEPS.map((step, index) => {
              const active = step.id === activeStepId;

              return (
                <button
                  key={step.id}
                  className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left ${
                    active ? "border-primary bg-primary/10" : "border-border/60"
                  }`}
                  type="button"
                  onClick={() => setActiveStepId(step.id)}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full text-sm ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 rounded-[20px] border border-border/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold">
                {GENERAL_STEPS.find((step) => step.id === activeStepId)?.label}
              </p>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  const currentIndex = GENERAL_STEPS.findIndex(
                    (step) => step.id === activeStepId,
                  );
                  const nextStep = GENERAL_STEPS[currentIndex + 1];

                  if (nextStep) {
                    setActiveStepId(nextStep.id);
                  }
                }}
              >
                Next
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
            {stepContent[activeStepId]}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {GENERAL_STEPS.map((step) => (
            <div
              key={step.id}
              className="grid gap-3 rounded-[20px] border border-border/70 p-4"
            >
              <p className="text-base font-semibold">{step.label}</p>
              {stepContent[step.id]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
