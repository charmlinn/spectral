import type { ExportArtifactDescriptor, RenderSession } from "@spectral/render-session";

export type PlannedRenderArtifacts = {
  finalArtifact: ExportArtifactDescriptor;
  posterArtifact: ExportArtifactDescriptor | null;
  chunkArtifacts: ExportArtifactDescriptor[];
  thumbnailArtifacts: ExportArtifactDescriptor[];
  previewArtifacts: ExportArtifactDescriptor[];
};

export type ArtifactPlannerInput = {
  session: RenderSession;
  chunkCount?: number;
};

export type ValidateRenderOutputInput = {
  session: RenderSession;
  outputPath: string;
  posterPath?: string | null;
};

export type ValidatedRenderOutput = {
  outputPath: string;
  outputByteSize: number;
  posterPath: string | null;
  posterByteSize: number | null;
  formatExtension: string;
};

export type EncodeRenderInput = {
  session: RenderSession;
  outputPath: string;
  posterPath?: string | null;
  workingDirectory?: string;
};

export type EncodeRenderResult = {
  outputPath: string;
  posterPath: string | null;
  artifacts: PlannedRenderArtifacts;
  validation: ValidatedRenderOutput;
  metadata: Record<string, unknown>;
};

export type EncoderDriver = {
  encode(input: EncodeRenderInput): Promise<EncodeRenderResult>;
};
