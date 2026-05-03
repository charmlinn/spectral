import {
  createDefaultVideoProject,
  normalizeVideoProject,
  type VideoProject,
} from "@spectral/project-schema";

import { notFound } from "../errors";
import { getServerRepositories } from "../repositories";
import { repairPresetDerivedProjectData } from "./project-preset-repair";

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

export async function listProjects() {
  const { projectRepository } = getServerRepositories();

  return projectRepository.listProjects();
}

export async function getProject(projectId: string) {
  const { presetRepository, projectRepository } = getServerRepositories();
  const project = await projectRepository.getProjectWithActiveSnapshot(projectId);

  if (!project) {
    throw notFound("Project not found.", {
      projectId,
    });
  }

  if (!project.project.presetId || !project.activeSnapshot || !project.activeProject) {
    return project;
  }

  const preset = await presetRepository.getPresetById(project.project.presetId);

  if (!preset) {
    return project;
  }

  const repairedProjectData = repairPresetDerivedProjectData(
    project.activeProject,
    preset.projectData,
  );

  if (repairedProjectData === project.activeProject) {
    return project;
  }

  return {
    ...project,
    activeProject: repairedProjectData,
    activeSnapshot: {
      ...project.activeSnapshot,
      projectData: repairedProjectData,
    },
  };

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
  const { presetRepository, projectRepository } = getServerRepositories();

  const projectDetail = await getProject(projectId);
  let projectData = input.projectData;

  if (projectDetail.project.presetId) {
    const preset = await presetRepository.getPresetById(projectDetail.project.presetId);

    if (preset) {
      projectData = repairPresetDerivedProjectData(
        projectData,
        preset.projectData,
      );
    }
  }

  const snapshot = await projectRepository.saveSnapshot({
    projectId,
    projectData,
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
