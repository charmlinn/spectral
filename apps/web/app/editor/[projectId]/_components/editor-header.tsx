"use client";

import Link from "next/link";
import { ArrowLeft, MoreHorizontal, PanelRight, Rocket, Save, Sparkles } from "lucide-react";

import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import { Card } from "@spectral/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spectral/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spectral/ui/components/select";

type EditorHeaderProps = {
  inspectorOpen: boolean;
  lastSavedAt: string;
  presetName: string;
  projectId: string;
  resolution: string;
  status: "Draft" | "Autosaved";
  title: string;
  onOpenMobileInspector: () => void;
  onToggleInspector: () => void;
};

export function EditorHeader({
  inspectorOpen,
  lastSavedAt,
  presetName,
  projectId,
  resolution,
  status,
  title,
  onOpenMobileInspector,
  onToggleInspector,
}: EditorHeaderProps) {
  const formattedSaveTime = new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(lastSavedAt));

  return (
    <Card className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/editor">
                <ArrowLeft className="size-4" />
                Projects
              </Link>
            </Button>
            <Badge variant="secondary">{status}</Badge>
            <Badge variant="outline">{resolution}</Badge>
            <Badge>{presetName}</Badge>
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Project ID: {projectId} · Last save checkpoint {formattedSaveTime}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select defaultValue={resolution}>
            <SelectTrigger className="min-w-36 bg-background/70">
              <SelectValue placeholder="Output preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={resolution}>{resolution}</SelectItem>
              <SelectItem value="1080 x 1080">1080 x 1080</SelectItem>
              <SelectItem value="3840 x 2160">3840 x 2160</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" />
            Presets
          </Button>
          <Button size="sm" variant="outline">
            <Save className="size-4" />
            Save draft
          </Button>
          <Button size="sm">
            <Rocket className="size-4" />
            Export
          </Button>
          <Button className="xl:hidden" size="icon" variant="outline" onClick={onOpenMobileInspector}>
            <PanelRight className="size-4" />
            <span className="sr-only">Open mobile inspector</span>
          </Button>
          <Button
            aria-pressed={inspectorOpen}
            className="hidden xl:inline-flex"
            size="icon"
            variant={inspectorOpen ? "secondary" : "outline"}
            onClick={onToggleInspector}
          >
            <PanelRight className="size-4" />
            <span className="sr-only">Toggle inspector</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open project actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Duplicate draft</DropdownMenuItem>
              <DropdownMenuItem>Open export history</DropdownMenuItem>
              <DropdownMenuItem>Reveal save checkpoints</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Archive shell</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
