"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Plus } from "lucide-react";

import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Input } from "@spectral/ui/components/input";
import { Label } from "@spectral/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spectral/ui/components/select";

import type { ProjectDetailDto } from "@/src/lib/editor-api";

type CreateProjectResponse = ProjectDetailDto;
type PresetSummary = {
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
  const [presetId, setPresetId] = useState<string>("none");
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
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          requestError instanceof Error ? requestError.message : "Failed to load presets.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
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
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger id="project-preset">
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
          </div>
          <Button
            className="w-full"
            disabled={pendingAction !== null || projectName.trim().length === 0}
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
  );
}
