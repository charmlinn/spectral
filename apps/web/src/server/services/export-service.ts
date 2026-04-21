import { withTransaction } from "@spectral/db";
import { migrateVideoProjectDocument } from "@spectral/project-schema";

import {
  badRequest,
  notFound,
  serviceUnavailable,
} from "../errors";
import { getServerRepositories } from "../repositories";
import { publishExportRenderMessage } from "../queue";

async function getSnapshotForExport(projectId: string, snapshotId?: string) {
  const { prisma, projectRepository } = getServerRepositories();
  const project = await projectRepository.getProjectWithActiveSnapshot(projectId);

  if (!project) {
    throw notFound("Project not found.", {
      projectId,
    });
  }

  const targetSnapshotId = snapshotId ?? project.activeSnapshot?.id;

  if (!targetSnapshotId) {
    throw badRequest("Project has no active snapshot.", {
      projectId,
    });
  }

  const snapshot = await prisma.projectSnapshot.findUnique({
    where: {
      id: targetSnapshotId,
    },
  });

  if (!snapshot || snapshot.projectId !== projectId) {
    throw notFound("Project snapshot not found.", {
      projectId,
      snapshotId: targetSnapshotId,
    });
  }

  return {
    project,
    snapshot,
    normalizedProject: migrateVideoProjectDocument(snapshot.projectData),
  };
}

export async function createExportJob(input: {
  projectId: string;
  snapshotId?: string;
  format?: "mp4" | "mov" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const { exportJobRepository, prisma } = getServerRepositories();
  const exportTarget = await getSnapshotForExport(input.projectId, input.snapshotId);
  const normalizedProject = exportTarget.normalizedProject;

  const job = await withTransaction(prisma, async (tx) => {
    const createdJob = await tx.exportJob.create({
      data: {
        projectId: input.projectId,
        snapshotId: exportTarget.snapshot.id,
        status: "queued",
        format: input.format ?? normalizedProject.export.format,
        width: input.width ?? normalizedProject.export.width,
        height: input.height ?? normalizedProject.export.height,
        fps: input.fps ?? normalizedProject.export.fps,
        durationMs: input.durationMs ?? normalizedProject.timing.durationMs,
        metadata: input.metadata ?? {},
        queuedAt: new Date(),
      },
    });

    await tx.exportJobEvent.create({
      data: {
        jobId: createdJob.id,
        projectId: input.projectId,
        type: "queued",
        message: "Export job queued.",
        progress: 0,
        payload: {
          snapshotId: exportTarget.snapshot.id,
        },
      },
    });

    return createdJob;
  });

  try {
    await publishExportRenderMessage({
      exportJobId: job.id,
      requestedAt: new Date().toISOString(),
    });
  } catch (error) {
    await exportJobRepository.appendEvent(job.id, {
      projectId: input.projectId,
      level: "error",
      type: "publish_failed",
      message: "Export job was created but queue publish failed.",
      payload: {
        snapshotId: exportTarget.snapshot.id,
      },
    });

    throw serviceUnavailable("Export job created, but queue publish failed.", {
      exportJobId: job.id,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  return getExportJob(job.id);
}

export async function getExportJob(exportJobId: string) {
  const { exportJobRepository } = getServerRepositories();
  const job = await exportJobRepository.getJobById(exportJobId);

  if (!job) {
    throw notFound("Export job not found.", {
      exportJobId,
    });
  }

  return job;
}

export async function cancelExportJob(exportJobId: string) {
  const { exportJobRepository } = getServerRepositories();
  const job = await getExportJob(exportJobId);

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return job;
  }

  await exportJobRepository.updateJobStatus(exportJobId, {
    status: "cancelled",
    errorCode: "EXPORT_CANCELLED",
    errorMessage: "Export was cancelled by API request.",
  });
  await exportJobRepository.appendEvent(exportJobId, {
    projectId: job.projectId,
    type: "cancelled",
    message: "Export job cancelled.",
    progress: job.progress,
  });

  return getExportJob(exportJobId);
}

export async function getRenderPayload(exportJobId: string) {
  const { prisma } = getServerRepositories();
  const job = await getExportJob(exportJobId);
  const snapshot = await prisma.projectSnapshot.findUnique({
    where: {
      id: job.snapshotId,
    },
  });

  if (!snapshot) {
    throw notFound("Export snapshot not found.", {
      exportJobId,
      snapshotId: job.snapshotId,
    });
  }

  return {
    exportJob: job,
    projectSnapshot: snapshot,
    normalizedProject: migrateVideoProjectDocument(snapshot.projectData),
  };
}
