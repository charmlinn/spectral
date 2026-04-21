import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import type { ExportJobDto, ProjectDetailDto } from "@/src/lib/editor-api";

import { EditorShell } from "./editor-shell";

type EditorProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    throw new Error("Unable to resolve request host for editor bootstrap.");
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    let message = `Failed to load ${url}.`;

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

  return response.json() as Promise<T>;
}

async function loadEditorBootstrap(projectId: string) {
  const origin = await getRequestOrigin();
  const [projectDetail, exportJobs] = await Promise.all([
    loadJson<ProjectDetailDto>(`${origin}/api/projects/${projectId}`),
    loadJson<ExportJobDto[]>(`${origin}/api/projects/${projectId}/exports`),
  ]);

  if (!projectDetail.activeProject || !projectDetail.activeSnapshot) {
    throw new Error(`Project ${projectId} is missing an active snapshot.`);
  }

  return {
    projectDetail,
    exportJobs,
  };
}

export async function generateMetadata({ params }: EditorProjectPageProps): Promise<Metadata> {
  const { projectId } = await params;

  try {
    const { projectDetail } = await loadEditorBootstrap(projectId);

    return {
      title: `${projectDetail.project.name} | Spectral`,
    };
  } catch {
    return {
      title: "Editor | Spectral",
    };
  }
}

export default async function EditorProjectPage({ params }: EditorProjectPageProps) {
  const { projectId } = await params;
  const { projectDetail, exportJobs } = await loadEditorBootstrap(projectId);

  return (
    <EditorShell
      initialExportJobs={exportJobs}
      initialProjectDetail={projectDetail}
      projectId={projectId}
    />
  );
}
