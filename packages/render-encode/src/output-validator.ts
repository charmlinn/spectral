import { access, stat } from "node:fs/promises";
import { extname } from "node:path";
import { constants } from "node:fs";

import type { ExportFormat } from "@spectral/render-session";

import type { ValidateRenderOutputInput, ValidatedRenderOutput } from "./contracts";

function inferExpectedExtension(format: ExportFormat): string {
  switch (format) {
    case "mov":
      return ".mov";
    case "webm":
      return ".webm";
    case "mp4":
    default:
      return ".mp4";
  }
}

async function assertFileReadable(path: string): Promise<number> {
  await access(path, constants.R_OK);
  const fileStat = await stat(path);

  if (!fileStat.isFile()) {
    throw new Error(`Expected a file at ${path}.`);
  }

  if (fileStat.size <= 0) {
    throw new Error(`Expected a non-empty file at ${path}.`);
  }

  return fileStat.size;
}

export async function validateRenderOutput(
  input: ValidateRenderOutputInput,
): Promise<ValidatedRenderOutput> {
  const expectedExtension = inferExpectedExtension(input.session.output.format);
  const outputExtension = extname(input.outputPath).toLowerCase();

  if (outputExtension !== expectedExtension) {
    throw new Error(
      `Output path ${input.outputPath} does not match export format ${input.session.output.format}.`,
    );
  }

  const outputByteSize = await assertFileReadable(input.outputPath);
  const posterPath = input.posterPath ?? null;
  const posterByteSize = posterPath ? await assertFileReadable(posterPath) : null;

  return {
    outputPath: input.outputPath,
    outputByteSize,
    posterPath,
    posterByteSize,
    formatExtension: expectedExtension.slice(1),
  };
}
