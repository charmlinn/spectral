"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ImagePlus,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

import { useProjectStore } from "@spectral/editor-store";
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
import { Separator } from "@spectral/ui/components/separator";
import { Switch } from "@spectral/ui/components/switch";

import {
  completeAsset,
  createAssetUploadUrl,
  uploadFileToSignedUrl,
} from "@/src/lib/editor-api";

type VisualizerSidebarProps = {
  projectId: string;
};

type VisualizerTab = "layers" | "shape" | "motion" | "effects";

const VISUALIZER_TABS: Array<{ id: VisualizerTab; label: string }> = [
  { id: "layers", label: "Layers" },
  { id: "shape", label: "Shape" },
  { id: "motion", label: "Motion" },
  { id: "effects", label: "Effects" },
];

const VISUALIZER_SHAPES = [
  { value: "circle", label: "Circle" },
  { value: "flat", label: "Flat" },
];

const VISUALIZER_WAVE_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "bar", label: "Bar" },
  { value: "point", label: "Point" },
];

const VISUALIZER_WAVE_TYPES = [
  { value: "spectrum", label: "Spectrum" },
  { value: "bass spectrum", label: "Bass Spectrum" },
  { value: "wide spectrum", label: "Wide Spectrum" },
  { value: "waveform", label: "Waveform" },
];

const VISUALIZER_REFLECTION_TYPES = [
  { value: "none", label: "None" },
  { value: "vertical", label: "Vertical" },
  { value: "slanted", label: "Slanted" },
  { value: "three way", label: "Three Way" },
  { value: "four way", label: "Four Way" },
  { value: "1 side", label: "1 Side" },
  { value: "2 sides", label: "2 Sides" },
  { value: "combo", label: "Combo" },
];

const VISUALIZER_LAYOUT_TYPES = [
  { value: "default", label: "Default" },
  { value: "webbed", label: "Webbed" },
  { value: "layered", label: "Layered" },
  { value: "stacked", label: "Stacked" },
  { value: "target", label: "Target" },
];

const VISUALIZER_SHAKE_AMOUNTS = [
  { value: "none", label: "None" },
  { value: "little", label: "Little" },
  { value: "lot", label: "Lot" },
];

const VISUALIZER_GLOW_TYPES = [
  { value: "outer", label: "Outer" },
  { value: "inner", label: "Inner" },
];

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColorForInput(value: string | null | undefined, fallback = "#ffffff") {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized.startsWith("#")) {
    return normalized.length === 7 ? normalized : fallback;
  }

  if (normalized.startsWith("0x") && normalized.length === 8) {
    return `#${normalized.slice(2)}`;
  }

  return fallback;
}

function toVisualizerColor(value: string) {
  return `0x${value.replace("#", "").toLowerCase()}`;
}

async function measureImageFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
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

    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-border/70 p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ToggleField({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
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

function NumberField({
  label,
  onChange,
  step,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="number"
        step={step}
        value={String(value)}
        onChange={(event) => {
          const nextValue = toNumber(event.target.value);

          if (nextValue !== null) {
            onChange(nextValue);
          }
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ColorField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string | null | undefined;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="color"
        value={normalizeColorForInput(value)}
        onChange={(event) => onChange(toVisualizerColor(event.target.value))}
      />
    </label>
  );
}

function NullableColorField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string | null) => void;
  value: string | null | undefined;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={normalizeColorForInput(value)}
          disabled={value === null}
          onChange={(event) => onChange(toVisualizerColor(event.target.value))}
        />
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange(value === null ? "0xffffff" : null)}
        >
          {value === null ? "Enable" : "Clear"}
        </Button>
      </div>
    </div>
  );
}

export function VisualizerSidebar({ projectId }: VisualizerSidebarProps) {
  const [currentTab, setCurrentTab] = useState<VisualizerTab>("layers");
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const project = useProjectStore((state) => state.project);
  const updateAtPath = useProjectStore((state) => state.updateAtPath);
  const applyPatch = useProjectStore((state) => state.applyPatch);
  const addVisualizerWaveLayer = useProjectStore((state) => state.addVisualizerWaveLayer);
  const updateVisualizerWaveLayer = useProjectStore((state) => state.updateVisualizerWaveLayer);
  const updateVisualizerWaveLayerCustomOptions = useProjectStore(
    (state) => state.updateVisualizerWaveLayerCustomOptions,
  );
  const updateVisualizerWaveLayerSpinSettings = useProjectStore(
    (state) => state.updateVisualizerWaveLayerSpinSettings,
  );
  const removeVisualizerWaveLayer = useProjectStore((state) => state.removeVisualizerWaveLayer);
  const duplicateVisualizerWaveLayer = useProjectStore((state) => state.duplicateVisualizerWaveLayer);
  const moveVisualizerWaveLayer = useProjectStore((state) => state.moveVisualizerWaveLayer);

  const visualizer = project.visualizer;
  const reversedLayers = useMemo(
    () =>
      visualizer.waveCircles.map((layer, index) => ({
        layer,
        label: `Wave Layer ${visualizer.waveCircles.length - index}`,
        index,
      })).reverse(),
    [visualizer.waveCircles],
  );
  const selectedLayer = visualizer.waveCircles[selectedLayerIndex] ?? null;
  const customOptions = selectedLayer?.customOptions ?? {};
  const layerCustomEnabled = Boolean(customOptions.enabled);

  useEffect(() => {
    if (visualizer.waveCircles.length === 0) {
      setSelectedLayerIndex(0);
      return;
    }

    if (selectedLayerIndex >= visualizer.waveCircles.length) {
      setSelectedLayerIndex(visualizer.waveCircles.length - 1);
    }
  }, [selectedLayerIndex, visualizer.waveCircles.length]);

  async function handleVisualizerMediaUpload(file: File) {
    setUploadingMedia(true);
    setUploadError(null);

    try {
      const uploadPlan = await createAssetUploadUrl({
        projectId,
        kind: "logo",
        contentType: file.type || "image/png",
        originalFilename: file.name,
      });

      await uploadFileToSignedUrl(uploadPlan.upload, file);
      const dimensions = await measureImageFile(file);
      const asset = await completeAsset({
        assetId: uploadPlan.asset.id,
        byteSize: file.size,
        height: dimensions.height,
        width: dimensions.width,
      });

      const nextSource = {
        assetId: asset.id,
        storageKey: asset.storageKey,
        url: asset.resolvedUrl,
        kind: "logo" as const,
        origin: "upload" as const,
        mimeType: asset.mimeType,
      };

      applyPatch((currentProject) => ({
        ...currentProject,
        visualizer: {
          ...currentProject.visualizer,
          logoVisible: true,
          logoSource: nextSource,
          mediaSource: nextSource,
        },
      }));
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload visualizer media.",
      );
    } finally {
      setUploadingMedia(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-[20px] border border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Visualizer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Specterr-style visualizer controls are now split into Layers, Shape, Motion, and Effects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void handleVisualizerMediaUpload(file);
                }

                event.target.value = "";
              }}
            />
            <Button
              disabled={uploadingMedia}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => uploadInputRef.current?.click()}
            >
              <ImagePlus className="mr-2 size-4" />
              {uploadingMedia ? "Uploading..." : "Select Media"}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {VISUALIZER_TABS.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              type="button"
              variant={currentTab === tab.id ? "secondary" : "outline"}
              onClick={() => setCurrentTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <ToggleField
          checked={visualizer.enabled}
          label="Visualizer enabled"
          onCheckedChange={(checked) => updateAtPath(["visualizer", "enabled"], checked)}
        />
        <div className="grid gap-2">
          <span className="text-sm font-medium">Current media</span>
          <Input
            readOnly
            value={
              visualizer.logoSource?.assetId ??
              visualizer.mediaSource?.assetId ??
              visualizer.logoSource?.url ??
              visualizer.mediaSource?.url ??
              "No visualizer media"
            }
          />
          {uploadError ? (
            <p className="text-xs text-destructive">{uploadError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() =>
                applyPatch((currentProject) => ({
                  ...currentProject,
                  visualizer: {
                    ...currentProject.visualizer,
                    mediaSource: null,
                    logoSource: null,
                  },
                }))
              }
            >
              Clear Media
            </Button>
            <div className="flex min-w-0 flex-1 items-center justify-between rounded-[16px] border border-border/60 px-3 py-2">
              <Label>Logo visible</Label>
              <Switch
                checked={visualizer.logoVisible}
                onCheckedChange={(checked) =>
                  updateAtPath(["visualizer", "logoVisible"], checked)
                }
              />
            </div>
          </div>
        </div>
      </div>

      {currentTab === "layers" ? (
        <div className="grid gap-4">
          <Section
            title="Wave Layers"
            description="Add, remove, duplicate, reorder, and edit individual wave rings."
          >
            <div className="flex items-center justify-end gap-2">
              <Button
                disabled={visualizer.waveCircles.length <= 1}
                size="icon"
                type="button"
                variant="outline"
                onClick={() => removeVisualizerWaveLayer(selectedLayerIndex)}
              >
                <Minus className="size-4" />
              </Button>
              <Button
                disabled={visualizer.waveCircles.length >= 7}
                size="icon"
                type="button"
                variant="outline"
                onClick={() => addVisualizerWaveLayer()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="grid gap-2">
              {reversedLayers.map(({ index, label, layer }) => (
                <button
                  key={`${label}-${index}`}
                  className={`flex items-center justify-between rounded-[16px] border px-3 py-3 text-left ${
                    index === selectedLayerIndex
                      ? "border-primary bg-primary/10"
                      : "border-border/60"
                  }`}
                  type="button"
                  onClick={() => setSelectedLayerIndex(index)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-6 rounded-full border border-border/70"
                      style={{
                        backgroundColor: normalizeColorForInput(layer.fillColor, "#ffffff"),
                      }}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      disabled={index >= visualizer.waveCircles.length - 1}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveVisualizerWaveLayer(index, index + 1);
                      }}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      disabled={index <= 0}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveVisualizerWaveLayer(index, index - 1);
                      }}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      disabled={visualizer.waveCircles.length >= 7}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        duplicateVisualizerWaveLayer(index);
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      disabled={visualizer.waveCircles.length <= 1}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeVisualizerWaveLayer(index);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
            <Button
              disabled={visualizer.waveCircles.length >= 7}
              type="button"
              variant="outline"
              onClick={() => addVisualizerWaveLayer()}
            >
              <Plus className="mr-2 size-4" />
              Add Layer
            </Button>
          </Section>

          {selectedLayer ? (
            <>
              <Section title="Layer Core">
                <ToggleField
                  checked={selectedLayer.visible}
                  label="Visible"
                  onCheckedChange={(checked) =>
                    updateVisualizerWaveLayer(selectedLayerIndex, { visible: checked })
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField
                    label="Fill color"
                    value={selectedLayer.fillColor}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, { fillColor: value })
                    }
                  />
                  <NullableColorField
                    label="Secondary fill"
                    value={selectedLayer.secondaryFillColor}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, {
                        secondaryFillColor: value,
                      })
                    }
                  />
                  <ColorField
                    label="Line color"
                    value={selectedLayer.lineColor}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, { lineColor: value })
                    }
                  />
                  <NullableColorField
                    label="Secondary line"
                    value={selectedLayer.secondaryLineColor}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, {
                        secondaryLineColor: value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Fill alpha"
                    step={0.01}
                    value={selectedLayer.fillAlpha}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, { fillAlpha: value })
                    }
                  />
                  <NumberField
                    label="Secondary fill alpha"
                    step={0.01}
                    value={selectedLayer.secondaryFillAlpha}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, {
                        secondaryFillAlpha: value,
                      })
                    }
                  />
                  <NumberField
                    label="Line width"
                    step={0.01}
                    value={selectedLayer.lineWidth}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, { lineWidth: value })
                    }
                  />
                  <NumberField
                    label="Line alpha"
                    step={0.01}
                    value={selectedLayer.lineAlpha}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, { lineAlpha: value })
                    }
                  />
                  <NumberField
                    label="Secondary line alpha"
                    step={0.01}
                    value={selectedLayer.secondaryLineAlpha}
                    onChange={(value) =>
                      updateVisualizerWaveLayer(selectedLayerIndex, {
                        secondaryLineAlpha: value,
                      })
                    }
                  />
                </div>
              </Section>

              <Section title="Layer Motion">
                <ToggleField
                  checked={selectedLayer.spinSettings.enabled}
                  label="Layer spin"
                  onCheckedChange={(checked) =>
                    updateVisualizerWaveLayerSpinSettings(selectedLayerIndex, {
                      enabled: checked,
                    })
                  }
                />
                {selectedLayer.spinSettings.enabled ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      label="Spin speed"
                      step={0.1}
                      value={selectedLayer.spinSettings.speed}
                      onChange={(value) =>
                        updateVisualizerWaveLayerSpinSettings(selectedLayerIndex, {
                          speed: value,
                        })
                      }
                    />
                    <NumberField
                      label="Spin acceleration"
                      step={0.1}
                      value={selectedLayer.spinSettings.acceleration}
                      onChange={(value) =>
                        updateVisualizerWaveLayerSpinSettings(selectedLayerIndex, {
                          acceleration: value,
                        })
                      }
                    />
                  </div>
                ) : null}
              </Section>

              <Section title="Layer Custom Options">
                <ToggleField
                  checked={layerCustomEnabled}
                  label="Custom layer settings"
                  onCheckedChange={(checked) =>
                    updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                      enabled: checked,
                    })
                  }
                />
                {layerCustomEnabled ? (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Wave type"
                        options={VISUALIZER_WAVE_TYPES}
                        value={String(customOptions.waveType ?? visualizer.waveType)}
                        onValueChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            waveType: value,
                          })
                        }
                      />
                      <SelectField
                        label="Reflection"
                        options={VISUALIZER_REFLECTION_TYPES}
                        value={String(customOptions.reflectionType ?? visualizer.reflectionType)}
                        onValueChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            reflectionType: value,
                          })
                        }
                      />
                      <SelectField
                        label="Wave style"
                        options={VISUALIZER_WAVE_STYLES}
                        value={String(customOptions.waveStyle ?? visualizer.waveStyle)}
                        onValueChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            waveStyle: value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ToggleField
                        checked={Boolean(customOptions.smoothed ?? visualizer.smoothed)}
                        label="Smoothed"
                        onCheckedChange={(checked) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            smoothed: checked,
                          })
                        }
                      />
                      <ToggleField
                        checked={Boolean(customOptions.inverted ?? visualizer.inverted)}
                        label="Inverted"
                        onCheckedChange={(checked) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            inverted: checked,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberField
                        label="Rotation"
                        step={0.1}
                        value={Number(customOptions.rotation ?? 0)}
                        onChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            rotation: value,
                          })
                        }
                      />
                      <NumberField
                        label="Wave height"
                        step={0.01}
                        value={Number(customOptions.waveScaleFactor ?? visualizer.waveScaleFactor)}
                        onChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            waveScaleFactor: value,
                          })
                        }
                      />
                      <NumberField
                        label="Point count"
                        value={Number(customOptions.barCount ?? visualizer.barCount)}
                        onChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            barCount: value,
                          })
                        }
                      />
                      <NumberField
                        label="Bar width"
                        step={0.01}
                        value={Number(customOptions.barWidth ?? visualizer.barWidth)}
                        onChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            barWidth: value,
                          })
                        }
                      />
                      <NumberField
                        label="Point radius"
                        step={0.01}
                        value={Number(customOptions.pointRadius ?? visualizer.pointRadius)}
                        onChange={(value) =>
                          updateVisualizerWaveLayerCustomOptions(selectedLayerIndex, {
                            pointRadius: value,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </Section>
            </>
          ) : (
            <Section title="No layers">
              <Button type="button" variant="outline" onClick={() => addVisualizerWaveLayer()}>
                <Plus className="mr-2 size-4" />
                Create First Layer
              </Button>
            </Section>
          )}
        </div>
      ) : null}

      {currentTab === "shape" ? (
        <div className="grid gap-4">
          <Section title="Shape">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Shape"
                options={VISUALIZER_SHAPES}
                value={visualizer.shape}
                onValueChange={(value) => updateAtPath(["visualizer", "shape"], value)}
              />
              <SelectField
                label="Wave style"
                options={VISUALIZER_WAVE_STYLES}
                value={visualizer.waveStyle}
                onValueChange={(value) => updateAtPath(["visualizer", "waveStyle"], value)}
              />
              <SelectField
                label="Reflection"
                options={VISUALIZER_REFLECTION_TYPES}
                value={visualizer.reflectionType}
                onValueChange={(value) => updateAtPath(["visualizer", "reflectionType"], value)}
              />
              <SelectField
                label="Layout"
                options={VISUALIZER_LAYOUT_TYPES}
                value={visualizer.layoutType}
                onValueChange={(value) => updateAtPath(["visualizer", "layoutType"], value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleField
                checked={visualizer.smoothed}
                label="Smoothed"
                onCheckedChange={(checked) => updateAtPath(["visualizer", "smoothed"], checked)}
              />
              <ToggleField
                checked={visualizer.inverted}
                label="Inverted"
                onCheckedChange={(checked) => updateAtPath(["visualizer", "inverted"], checked)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Point count"
                value={visualizer.barCount}
                onChange={(value) => updateAtPath(["visualizer", "barCount"], value)}
              />
              {visualizer.waveStyle === "bar" ? (
                <NumberField
                  label="Bar width"
                  step={0.01}
                  value={visualizer.barWidth}
                  onChange={(value) => updateAtPath(["visualizer", "barWidth"], value)}
                />
              ) : null}
              {visualizer.waveStyle === "point" ? (
                <NumberField
                  label="Point radius"
                  step={0.01}
                  value={visualizer.pointRadius}
                  onChange={(value) => updateAtPath(["visualizer", "pointRadius"], value)}
                />
              ) : null}
            </div>
          </Section>

          <Section title="Geometry">
            <div className="grid gap-3 sm:grid-cols-2">
              {visualizer.shape === "circle" ? (
                <>
                  <NumberField
                    label="Diameter"
                    step={0.1}
                    value={visualizer.radiusFactor}
                    onChange={(value) => updateAtPath(["visualizer", "radiusFactor"], value)}
                  />
                  <NumberField
                    label="Image size"
                    step={0.01}
                    value={visualizer.logoSizeFactor}
                    onChange={(value) => {
                      updateAtPath(["visualizer", "logoSizeFactor"], value);
                      updateAtPath(["visualizer", "logoVisible"], true);
                    }}
                  />
                </>
              ) : (
                <>
                  <NumberField
                    label="Width"
                    step={0.1}
                    value={visualizer.width}
                    onChange={(value) => updateAtPath(["visualizer", "width"], value)}
                  />
                  <NumberField
                    label="Base height"
                    step={0.1}
                    value={visualizer.baseHeight}
                    onChange={(value) => updateAtPath(["visualizer", "baseHeight"], value)}
                  />
                </>
              )}
              <NumberField
                label="Position X"
                step={0.1}
                value={visualizer.position.x}
                onChange={(value) =>
                  updateAtPath(["visualizer", "position"], {
                    ...visualizer.position,
                    x: value,
                  })
                }
              />
              <NumberField
                label="Position Y"
                step={0.1}
                value={visualizer.position.y}
                onChange={(value) =>
                  updateAtPath(["visualizer", "position"], {
                    ...visualizer.position,
                    y: value,
                  })
                }
              />
              <NumberField
                label="Wave height"
                step={0.01}
                value={visualizer.waveScaleFactor}
                onChange={(value) => updateAtPath(["visualizer", "waveScaleFactor"], value)}
              />
              <NumberField
                label="Separation"
                step={0.01}
                value={visualizer.seperationFactor}
                onChange={(value) => updateAtPath(["visualizer", "seperationFactor"], value)}
              />
              <NumberField
                label="Rotation"
                step={0.1}
                value={visualizer.rotation}
                onChange={(value) => updateAtPath(["visualizer", "rotation"], value)}
              />
              {visualizer.shape === "circle" ? (
                <NumberField
                  label="Center cutout"
                  step={0.1}
                  value={visualizer.centerCutoutFactor}
                  onChange={(value) =>
                    updateAtPath(["visualizer", "centerCutoutFactor"], value)
                  }
                />
              ) : null}
            </div>
          </Section>
        </div>
      ) : null}

      {currentTab === "motion" ? (
        <div className="grid gap-4">
          <Section title="Motion">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Spectrum"
                options={VISUALIZER_WAVE_TYPES}
                value={visualizer.waveType}
                onValueChange={(value) => updateAtPath(["visualizer", "waveType"], value)}
              />
              <ToggleField
                checked={visualizer.delayed}
                label="Wave delay"
                onCheckedChange={(checked) => updateAtPath(["visualizer", "delayed"], checked)}
              />
            </div>
          </Section>

          <Section title="Drift">
            <ToggleField
              checked={visualizer.drift.enabled}
              label="Drift enabled"
              onCheckedChange={(checked) =>
                updateAtPath(["visualizer", "drift"], {
                  ...visualizer.drift,
                  enabled: checked,
                })
              }
            />
            {visualizer.drift.enabled ? (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ToggleField
                    checked={visualizer.drift.customMode}
                    label="Customize drift"
                    onCheckedChange={(checked) =>
                      updateAtPath(["visualizer", "drift"], {
                        ...visualizer.drift,
                        customMode: checked,
                      })
                    }
                  />
                  <NumberField
                    label="Intensity"
                    step={1}
                    value={visualizer.drift.intensity}
                    onChange={(value) =>
                      updateAtPath(["visualizer", "drift"], {
                        ...visualizer.drift,
                        intensity: value,
                      })
                    }
                  />
                </div>
                {visualizer.drift.customMode ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      label="Amplitude X"
                      step={0.1}
                      value={visualizer.drift.amplitudeX}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          amplitudeX: value,
                        })
                      }
                    />
                    <NumberField
                      label="Amplitude Y"
                      step={0.1}
                      value={visualizer.drift.amplitudeY}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          amplitudeY: value,
                        })
                      }
                    />
                    <NumberField
                      label="Rotation"
                      step={0.1}
                      value={visualizer.drift.rotation}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          rotation: value,
                        })
                      }
                    />
                    <NumberField
                      label="Speed"
                      step={0.01}
                      value={visualizer.drift.speed}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          speed: value,
                        })
                      }
                    />
                    <NumberField
                      label="Octaves"
                      step={1}
                      value={visualizer.drift.octaves}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          octaves: value,
                        })
                      }
                    />
                    <NumberField
                      label="Scale"
                      step={0.01}
                      value={visualizer.drift.scale}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          scale: value,
                        })
                      }
                    />
                    <NumberField
                      label="Acceleration"
                      step={0.1}
                      value={visualizer.drift.acceleration}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "drift"], {
                          ...visualizer.drift,
                          acceleration: value,
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </Section>

          {!visualizer.drift.enabled ? (
            <>
              <Section title="Shake / Bounce">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Shake amount"
                    options={VISUALIZER_SHAKE_AMOUNTS}
                    value={visualizer.shakeAmount}
                    onValueChange={(value) => updateAtPath(["visualizer", "shakeAmount"], value)}
                  />
                  {visualizer.shape === "circle" ? (
                    <NumberField
                      label="Bounce factor"
                      step={0.01}
                      value={visualizer.bounceFactor}
                      onChange={(value) => updateAtPath(["visualizer", "bounceFactor"], value)}
                    />
                  ) : null}
                </div>
              </Section>

              <Section title="Spin">
                <ToggleField
                  checked={visualizer.spinSettings.enabled}
                  label="Spin enabled"
                  onCheckedChange={(checked) =>
                    updateAtPath(["visualizer", "spinSettings"], {
                      ...visualizer.spinSettings,
                      enabled: checked,
                    })
                  }
                />
                {visualizer.spinSettings.enabled ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      label="Spin speed"
                      step={0.1}
                      value={visualizer.spinSettings.speed}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "spinSettings"], {
                          ...visualizer.spinSettings,
                          speed: value,
                        })
                      }
                    />
                    <NumberField
                      label="Spin acceleration"
                      step={0.1}
                      value={visualizer.spinSettings.acceleration}
                      onChange={(value) =>
                        updateAtPath(["visualizer", "spinSettings"], {
                          ...visualizer.spinSettings,
                          acceleration: value,
                        })
                      }
                    />
                    <ToggleField
                      checked={visualizer.spinSettings.logoLocked}
                      label="Logo locked"
                      onCheckedChange={(checked) =>
                        updateAtPath(["visualizer", "spinSettings"], {
                          ...visualizer.spinSettings,
                          logoLocked: checked,
                        })
                      }
                    />
                  </div>
                ) : null}
              </Section>
            </>
          ) : null}
        </div>
      ) : null}

      {currentTab === "effects" ? (
        <div className="grid gap-4">
          <Section title="Glow">
            <ToggleField
              checked={visualizer.glowSettings.enabled}
              label="Glow enabled"
              onCheckedChange={(checked) =>
                updateAtPath(["visualizer", "glowSettings"], {
                  ...visualizer.glowSettings,
                  enabled: checked,
                })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Glow type"
                options={VISUALIZER_GLOW_TYPES}
                value={visualizer.glowSettings.glowType}
                onValueChange={(value) =>
                  updateAtPath(["visualizer", "glowSettings"], {
                    ...visualizer.glowSettings,
                    glowType: value,
                  })
                }
              />
              <NumberField
                label="Glow blur"
                step={0.1}
                value={visualizer.glowSettings.blur}
                onChange={(value) =>
                  updateAtPath(["visualizer", "glowSettings"], {
                    ...visualizer.glowSettings,
                    blur: value,
                  })
                }
              />
              <NumberField
                label="Glow scale"
                step={0.01}
                value={visualizer.glowSettings.scale}
                onChange={(value) =>
                  updateAtPath(["visualizer", "glowSettings"], {
                    ...visualizer.glowSettings,
                    scale: value,
                  })
                }
              />
            </div>
          </Section>

          <Section title="Fire">
            <ToggleField
              checked={visualizer.fireSettings.enabled}
              label="Fire enabled"
              onCheckedChange={(checked) =>
                updateAtPath(["visualizer", "fireSettings"], {
                  ...visualizer.fireSettings,
                  enabled: checked,
                })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Intensity"
                step={0.1}
                value={visualizer.fireSettings.intensity}
                onChange={(value) =>
                  updateAtPath(["visualizer", "fireSettings"], {
                    ...visualizer.fireSettings,
                    intensity: value,
                  })
                }
              />
              <NumberField
                label="Detail"
                step={0.1}
                value={visualizer.fireSettings.detail}
                onChange={(value) =>
                  updateAtPath(["visualizer", "fireSettings"], {
                    ...visualizer.fireSettings,
                    detail: value,
                  })
                }
              />
            </div>
          </Section>

          <Section title="Shadow">
            <ToggleField
              checked={visualizer.dropShadowSettings.enabled}
              label="Shadow enabled"
              onCheckedChange={(checked) =>
                updateAtPath(["visualizer", "dropShadowSettings"], {
                  ...visualizer.dropShadowSettings,
                  enabled: checked,
                })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                label="Shadow color"
                value={visualizer.dropShadowSettings.color}
                onChange={(value) =>
                  updateAtPath(["visualizer", "dropShadowSettings"], {
                    ...visualizer.dropShadowSettings,
                    color: value,
                  })
                }
              />
              <NumberField
                label="Shadow blur"
                step={0.1}
                value={visualizer.dropShadowSettings.blur}
                onChange={(value) =>
                  updateAtPath(["visualizer", "dropShadowSettings"], {
                    ...visualizer.dropShadowSettings,
                    blur: value,
                  })
                }
              />
              <NumberField
                label="Shadow opacity"
                step={0.01}
                value={visualizer.dropShadowSettings.opacity}
                onChange={(value) =>
                  updateAtPath(["visualizer", "dropShadowSettings"], {
                    ...visualizer.dropShadowSettings,
                    opacity: value,
                  })
                }
              />
            </div>
          </Section>
        </div>
      ) : null}

      <Separator />

      <label className="grid gap-2">
        <span className="text-sm font-medium">Pipeline</span>
        <Input
          value={visualizer.pipeline}
          onChange={(event) => updateAtPath(["visualizer", "pipeline"], event.target.value)}
        />
      </label>
    </div>
  );
}
