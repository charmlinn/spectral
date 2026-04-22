"use client";

import { Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@spectral/ui/components/switch";

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

function createDefaultParticleItem() {
  return {
    shape: "circle",
    color: "0xffffff",
    birthRate: 35,
    maxSize: 0.3,
    minSize: 0.1,
    maxOpacity: 1,
    minOpacity: 0.2,
    mediaData: null,
  };
}

function createDefaultParticleSettings() {
  const item = createDefaultParticleItem();

  return {
    enabled: true,
    speedUpEnabled: true,
    direction: "OUT",
    items: [item],
    color: item.color,
    birthRate: item.birthRate,
    maxSize: item.maxSize,
    minSize: item.minSize,
    maxOpacity: item.maxOpacity,
    minOpacity: item.minOpacity,
  };
}

function getPrimaryParticleColor(
  item:
    | ReturnType<typeof createDefaultParticleItem>
    | {
        color: string | null;
      }
    | undefined,
  fallback: string,
) {
  return item?.color ?? fallback;
}

function ensureParticleItems(project: ReturnType<typeof useProjectStore.getState>["project"]) {
  if (Array.isArray(project.overlays.particles.items)) {
    return project.overlays.particles.items;
  }

  return [createDefaultParticleItem()];
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

export function ElementsSidebar() {
  const project = useProjectStore((state) => state.project);
  const updateAtPath = useProjectStore((state) => state.updateAtPath);
  const applyPatch = useProjectStore((state) => state.applyPatch);

  const particleItems = ensureParticleItems(project);

  function patchParticleItem(index: number, patch: Partial<(typeof particleItems)[number]>) {
    applyPatch((currentProject) => {
      const currentItems = ensureParticleItems(currentProject);
      const nextItems = currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
            }
          : item,
      );

      const firstItem = nextItems[0] ?? createDefaultParticleItem();

      return {
        ...currentProject,
        overlays: {
          ...currentProject.overlays,
          particles: {
            ...currentProject.overlays.particles,
            enabled: true,
            items: nextItems,
            color: getPrimaryParticleColor(
              firstItem,
              currentProject.overlays.particles.color,
            ),
            birthRate: firstItem.birthRate,
            maxSize: firstItem.maxSize,
            minSize: firstItem.minSize,
            maxOpacity: firstItem.maxOpacity,
            minOpacity: firstItem.minOpacity,
          },
        },
      };
    });
  }

  function addParticleItem() {
    applyPatch((currentProject) => {
      const currentItems = ensureParticleItems(currentProject);

      if (currentItems.length >= 7) {
        return currentProject;
      }

      const nextItems = [...currentItems, createDefaultParticleItem()];
      const firstItem = nextItems[0] ?? createDefaultParticleItem();

      return {
        ...currentProject,
        overlays: {
          ...currentProject.overlays,
          particles: {
            ...currentProject.overlays.particles,
            enabled: true,
            items: nextItems,
            color: getPrimaryParticleColor(
              firstItem,
              currentProject.overlays.particles.color,
            ),
            birthRate: firstItem.birthRate,
            maxSize: firstItem.maxSize,
            minSize: firstItem.minSize,
            maxOpacity: firstItem.maxOpacity,
            minOpacity: firstItem.minOpacity,
          },
        },
      };
    });
  }

  function removeParticleItem(index: number) {
    applyPatch((currentProject) => {
      const currentItems = ensureParticleItems(currentProject);

      if (currentItems.length <= 1) {
        return {
          ...currentProject,
          overlays: {
            ...currentProject.overlays,
            particles: {
              ...currentProject.overlays.particles,
              enabled: false,
              items: currentItems,
            },
          },
        };
      }

      const nextItems = currentItems.filter((_, itemIndex) => itemIndex !== index);
      const firstItem = nextItems[0] ?? createDefaultParticleItem();

      return {
        ...currentProject,
        overlays: {
          ...currentProject.overlays,
          particles: {
            ...currentProject.overlays.particles,
            items: nextItems,
            color: getPrimaryParticleColor(
              firstItem,
              currentProject.overlays.particles.color,
            ),
            birthRate: firstItem.birthRate,
            maxSize: firstItem.maxSize,
            minSize: firstItem.minSize,
            maxOpacity: firstItem.maxOpacity,
            minOpacity: firstItem.minOpacity,
          },
        },
      };
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-[20px] border border-border/70 p-4">
        <p className="text-sm font-medium">Elements</p>
        <ToggleField
          checked={project.overlays.youTubeCta.enabled}
          description="Show the like-and-subscribe animation near the start of the video."
          label="Like & Subscribe Animation"
          onCheckedChange={(checked) =>
            updateAtPath(["overlays", "youTubeCta", "enabled"], checked)
          }
        />
        <label className="grid gap-2">
          <span className="text-sm font-medium">CTA Position</span>
          <Select
            value={project.overlays.youTubeCta.cornerPosition}
            onValueChange={(value) =>
              updateAtPath(["overlays", "youTubeCta", "cornerPosition"], value)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="grid gap-3 rounded-[20px] border border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Particles</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mirror the Specterr Elements section for floating particles.
            </p>
          </div>
          <Button
            disabled={particleItems.length >= 7}
            size="sm"
            type="button"
            variant="outline"
            onClick={addParticleItem}
          >
            <Plus className="mr-2 size-4" />
            Add Particle
          </Button>
        </div>

        <ToggleField
          checked={project.overlays.particles.enabled}
          description="Turn the particle layer on or off."
          label="Particles"
          onCheckedChange={(checked) =>
            applyPatch((currentProject) => ({
              ...currentProject,
              overlays: {
                ...currentProject.overlays,
                particles: checked
                  ? {
                      ...createDefaultParticleSettings(),
                      ...currentProject.overlays.particles,
                      enabled: true,
                      items: ensureParticleItems(currentProject),
                    }
                  : {
                      ...currentProject.overlays.particles,
                      enabled: false,
                    },
              },
            }))
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Direction</span>
            <Select
              value={project.overlays.particles.direction.toUpperCase()}
              onValueChange={(value) =>
                updateAtPath(["overlays", "particles", "direction"], value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UP">Up</SelectItem>
                <SelectItem value="DOWN">Down</SelectItem>
                <SelectItem value="LEFT">Left</SelectItem>
                <SelectItem value="RIGHT">Right</SelectItem>
                <SelectItem value="OUT">Out</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <ToggleField
            checked={project.overlays.particles.speedUpEnabled}
            label="Audio speed-up"
            onCheckedChange={(checked) =>
              updateAtPath(["overlays", "particles", "speedUpEnabled"], checked)
            }
          />
        </div>

        <div className="grid gap-3">
          {particleItems.map((item, index) => (
            <div
              key={`particle-item-${index}`}
              className="grid gap-3 rounded-[16px] border border-border/60 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Particle {index + 1}</p>
                <Button
                  disabled={particleItems.length <= 1}
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => removeParticleItem(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Shape</span>
                  <Select
                    value={item.shape}
                    onValueChange={(value) =>
                      patchParticleItem(index, { shape: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="heart">Heart</SelectItem>
                      <SelectItem value="star">Star</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Color</span>
                  <Input
                    type="color"
                    value={normalizeColorForInput(item.color)}
                    onChange={(event) =>
                      patchParticleItem(index, {
                        color: toHexColor(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Birth rate</span>
                  <Input
                    type="number"
                    value={String(item.birthRate)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        patchParticleItem(index, { birthRate: value });
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Min size</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(item.minSize)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        patchParticleItem(index, { minSize: value });
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Max size</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(item.maxSize)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        patchParticleItem(index, { maxSize: value });
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Min opacity</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(item.minOpacity)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        patchParticleItem(index, { minOpacity: value });
                      }
                    }}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Max opacity</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(item.maxOpacity)}
                    onChange={(event) => {
                      const value = toNumber(event.target.value);

                      if (value !== null) {
                        patchParticleItem(index, { maxOpacity: value });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
