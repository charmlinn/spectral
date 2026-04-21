import {
  createDefaultVideoProject,
  normalizeVideoProject,
  type VideoProject,
} from "@spectral/project-schema";

import { notFound } from "../errors";
import { getServerRepositories } from "../repositories";

export async function createProject(input: {
  name: string;
  description?: string | null;
  presetId?: string | null;
  metadata?: Record<string, unknown>;
  projectData?: VideoProject;
}) {
  const { presetRepository, projectRepository } = getServerRepositories();

  const preset = input.presetId
    ? await presetRepository.getPresetById(input.presetId)
    : null;

  if (input.presetId && !preset) {
    throw notFound("Preset not found.", {
      presetId: input.presetId,
    });
  }

  const project = await projectRepository.createProject({
    name: input.name,
    description: input.description ?? null,
    presetId: input.presetId ?? null,
    metadata: input.metadata,
  });

  const initialProject =
    input.projectData ??
    (preset
      ? normalizeVideoProject({
          ...preset.projectData,
          projectId: project.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          meta: {
            ...preset.projectData.meta,
            name: input.name,
            description: input.description ?? preset.projectData.meta.description ?? null,
            presetId: input.presetId ?? null,
            source: "preset",
          },
        })
      : undefined) ??
    createDefaultVideoProject({
      projectId: project.id,
      meta: {
        name: input.name,
        description: input.description ?? null,
        presetId: input.presetId ?? null,
        source: preset ? "preset" : "editor",
        tags: [],
      },
    });

  await projectRepository.saveSnapshot({
    projectId: project.id,
    projectData: initialProject,
    source: preset ? "preset" : "editor",
    reason: "initial-create",
  });

  return getProject(project.id);
}

export async function getProject(projectId: string) {
  const { projectRepository } = getServerRepositories();
  const project = await projectRepository.getProjectWithActiveSnapshot(projectId);

  if (!project) {
    throw notFound("Project not found.", {
      projectId,
    });
  }

  return project;
}

export async function updateProject(projectId: string, input: {
  name?: string;
  description?: string | null;
  presetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { projectRepository } = getServerRepositories();

  await getProject(projectId);
  await projectRepository.updateProjectMetadata(projectId, input);

  return getProject(projectId);
}

export async function saveProjectSnapshot(projectId: string, input: {
  projectData: VideoProject;
  source?: string;
  reason?: string | null;
  schemaVersion?: number;
}) {
  const { projectRepository } = getServerRepositories();

  await getProject(projectId);

  const snapshot = await projectRepository.saveSnapshot({
    projectId,
    projectData: input.projectData,
    source: input.source,
    reason: input.reason,
    schemaVersion: input.schemaVersion,
  });

  return {
    snapshot,
    project: await getProject(projectId),
  };
}

export async function listProjectExports(projectId: string) {
  const { exportJobRepository } = getServerRepositories();

  await getProject(projectId);

  return exportJobRepository.listJobsByProjectId(projectId);
}
