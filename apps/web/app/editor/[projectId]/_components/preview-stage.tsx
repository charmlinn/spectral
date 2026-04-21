"use client";

import { Pause, Play, ZoomIn } from "lucide-react";

import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@spectral/ui/components/tabs";

type PreviewStageProps = {
  activeSectionLabel: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  notes: string;
  previewStats: Array<{ label: string; value: string }>;
  stageLabel: string;
  zoomLevel: string;
  zoomSteps: string[];
  onZoomChange: (zoomLevel: string) => void;
};

function getAspectRatioValue(aspectRatio: PreviewStageProps["aspectRatio"]) {
  if (aspectRatio === "9:16") {
    return "9 / 16";
  }

  if (aspectRatio === "1:1") {
    return "1 / 1";
  }

  return "16 / 9";
}

export function PreviewStage({
  activeSectionLabel,
  aspectRatio,
  notes,
  previewStats,
  stageLabel,
  zoomLevel,
  zoomSteps,
  onZoomChange,
}: PreviewStageProps) {
  return (
    <Card className="surface-glow flex min-h-[26rem] flex-1 flex-col overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Preview stage</Badge>
              <Badge variant="outline">{stageLabel}</Badge>
              <Badge variant="outline">Focus: {activeSectionLabel}</Badge>
            </div>
            <div>
              <CardTitle>Center canvas container</CardTitle>
              <CardDescription>
                Stable mount point for the browser runtime, sized independently from the React shell.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline">
              <Play className="size-4" />
              Preview
            </Button>
            <Button size="sm" variant="outline">
              <Pause className="size-4" />
              Pause
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 p-1">
              <ZoomIn className="ml-2 size-4 text-muted-foreground" />
              {zoomSteps.map((step) => (
                <Button
                  key={step}
                  className="rounded-full"
                  size="sm"
                  variant={step === zoomLevel ? "secondary" : "ghost"}
                  onClick={() => onZoomChange(step)}
                >
                  {step}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <Tabs className="flex min-h-0 flex-1 flex-col gap-4" defaultValue="stage">
          <TabsList className="w-fit">
            <TabsTrigger value="stage">Stage</TabsTrigger>
            <TabsTrigger value="handoff">Handoff</TabsTrigger>
          </TabsList>

          <TabsContent value="stage" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex min-h-[24rem] items-center justify-center rounded-[28px] border border-border/70 bg-slate-950/55 p-4">
                <div
                  className="relative flex w-full max-w-4xl items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,1))] shadow-[0_34px_120px_-52px_rgba(15,23,42,0.95)]"
                  style={{ aspectRatio: getAspectRatioValue(aspectRatio) }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),transparent_50%,rgba(56,189,248,0.08))]" />
                  <div className="absolute inset-x-6 top-6 flex flex-wrap gap-2">
                    {previewStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/80 backdrop-blur"
                      >
                        {stat.label}: {stat.value}
                      </div>
                    ))}
                  </div>
                  <div className="relative flex flex-col items-center gap-3 px-6 text-center">
                    <div className="size-24 rounded-full border border-white/10 bg-white/5 shadow-[0_0_80px_rgba(251,191,36,0.16)]" />
                    <div className="space-y-2">
                      <p className="font-heading text-2xl font-semibold text-white sm:text-3xl">{stageLabel}</p>
                      <p className="max-w-md text-sm leading-6 text-slate-300">
                        Replace this visual shell with the PIXI runtime mount, resize observer, and playback
                        integration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-background/60 p-4">
                <p className="text-sm font-medium">Current notes</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{notes}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="handoff" className="rounded-[28px] border border-dashed border-border bg-background/50 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-medium">Runtime boundary</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Mount point for render runtime, playback controls, resize observer, and diagnostics.
                </p>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-medium">Data boundary</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Server-fetched project snapshots can hydrate this shell without rewriting layout code.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
