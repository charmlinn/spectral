import {
  buildExportChunkStorageKey,
  buildExportOutputStorageKey,
  buildExportPosterStorageKey,
  buildExportPreviewFrameStorageKey,
  buildExportThumbnailStorageKey,
} from "@spectral/media";
import type { ExportFormat, ExportArtifactDescriptor } from "@spectral/render-session";

import type { ArtifactPlannerInput, PlannedRenderArtifacts } from "./contracts";

function inferOutputExtension(format: ExportFormat): string {
  switch (format) {
    case "mov":
      return "mov";
    case "webm":
      return "webm";
    case "mp4":
    default:
      return "mp4";
  }
}

function inferOutputMimeType(format: ExportFormat): string {
  switch (format) {
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mp4":
    default:
      return "video/mp4";
  }
}

function createDescriptor(
  descriptor: ExportArtifactDescriptor,
): ExportArtifactDescriptor {
  return descriptor;
}

export function planRenderArtifacts(input: ArtifactPlannerInput): PlannedRenderArtifacts {
  const { session } = input;
  const extension = inferOutputExtension(session.output.format);
  const finalArtifact = createDescriptor({
    kind: "export_final",
    storageKey: buildExportOutputStorageKey({
      projectId: session.projectId,
      exportJobId: session.exportJobId,
      extension,
    }),
    mimeType: inferOutputMimeType(session.output.format),
    metadata: {
      format: session.output.format,
      videoCodec: session.output.videoCodec,
      audioCodec: session.output.audioCodec,
    },
  });
  const posterArtifact =
    session.output.posterFrame === null
      ? null
      : createDescriptor({
          kind: "poster",
          storageKey: buildExportPosterStorageKey({
            projectId: session.projectId,
            exportJobId: session.exportJobId,
            extension: "jpg",
          }),
          mimeType: "image/jpeg",
          metadata: {
            frame: session.output.posterFrame,
          },
        });
  const chunkArtifacts = Array.from({ length: Math.max(0, input.chunkCount ?? 0) }, (_, index) =>
    createDescriptor({
      kind: "export_chunk",
      storageKey: buildExportChunkStorageKey({
        projectId: session.projectId,
        exportJobId: session.exportJobId,
        chunkIndex: index,
        extension,
      }),
      mimeType: inferOutputMimeType(session.output.format),
      metadata: {
        chunkIndex: index,
      },
    }),
  );
  const thumbnailArtifacts = session.output.thumbnailFrames.map((frame) =>
    createDescriptor({
      kind: "thumbnail",
      storageKey: buildExportThumbnailStorageKey({
        projectId: session.projectId,
        exportJobId: session.exportJobId,
        frame,
        extension: "jpg",
      }),
      mimeType: "image/jpeg",
      metadata: {
        frame,
      },
    }),
  );
  const previewArtifacts = session.diagnostics.sampleFrames.map((frame) =>
    createDescriptor({
      kind: "preview_frame",
      storageKey: buildExportPreviewFrameStorageKey({
        projectId: session.projectId,
        exportJobId: session.exportJobId,
        frame,
        extension: "png",
      }),
      mimeType: "image/png",
      metadata: {
        frame,
      },
    }),
  );

  return {
    finalArtifact,
    posterArtifact,
    chunkArtifacts,
    thumbnailArtifacts,
    previewArtifacts,
  };
}

export function listPlannedArtifacts(plan: PlannedRenderArtifacts): ExportArtifactDescriptor[] {
  return [
    plan.finalArtifact,
    ...(plan.posterArtifact ? [plan.posterArtifact] : []),
    ...plan.chunkArtifacts,
    ...plan.thumbnailArtifacts,
    ...plan.previewArtifacts,
  ];
}
