"use client";

import type { HTMLAttributes } from "react";

import type { EditorInspectorCard } from "@/src/lib/editor-mocks";
import { cn } from "@spectral/ui/lib/utils";

import { Badge } from "@spectral/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Label } from "@spectral/ui/components/label";
import { Separator } from "@spectral/ui/components/separator";
import { Switch } from "@spectral/ui/components/switch";

type InspectorPanelProps = HTMLAttributes<HTMLDivElement> & {
  cards: EditorInspectorCard[];
  projectId: string;
};

export function InspectorPanel({ cards, className, projectId, ...props }: InspectorPanelProps) {
  return (
    <div className={cn("min-h-0 flex-col gap-4", className)} {...props}>
      <Card className="flex min-h-[32rem] flex-col">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Inspector</CardTitle>
            <Badge variant="outline">Reserved</Badge>
          </div>
          <CardDescription>
            Right-side drawer space for diagnostics, assets, and object-level controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="runtime-overlay">Runtime overlay</Label>
                  <p className="text-xs text-muted-foreground">Reserved toggle for FPS, warnings, and mount health.</p>
                </div>
                <Switch defaultChecked id="runtime-overlay" />
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="autosave-stream">Autosave stream</Label>
                  <p className="text-xs text-muted-foreground">Placeholder binding for dirty-state and persistence UI.</p>
                </div>
                <Switch id="autosave-stream" />
              </div>
            </div>
          </div>

          {cards.map((card, index) => (
            <div key={card.title} className="space-y-3 rounded-[24px] border border-border/70 bg-background/60 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-primary">{card.value}</p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
              {index < cards.length - 1 ? <Separator className="bg-border/60" /> : null}
            </div>
          ))}

          <div className="rounded-[24px] border border-dashed border-border p-4 text-sm text-muted-foreground">
            Inspector mount key: <span className="font-medium text-foreground">{projectId}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
