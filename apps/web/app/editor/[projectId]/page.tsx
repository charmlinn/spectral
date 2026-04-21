import type { Metadata } from "next";

import { getEditorProject } from "@/src/lib/editor-mocks";

import { EditorShell } from "./editor-shell";

type EditorProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function generateMetadata({ params }: EditorProjectPageProps): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getEditorProject(projectId);

  return {
    title: `${project.title} | Spectral`,
  };
}

export default async function EditorProjectPage({ params }: EditorProjectPageProps) {
  const { projectId } = await params;
  const project = await getEditorProject(projectId);

  return <EditorShell project={project} />;
}

