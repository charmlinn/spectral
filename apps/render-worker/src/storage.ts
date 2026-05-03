import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { createR2StorageAdapterFromEnv } from "@spectral/media";
import type { ExportArtifactDescriptor } from "@spectral/render-session";

type ArtifactUploadInput = {
  filePath: string;
  artifact: ExportArtifactDescriptor;
};

export type UploadedArtifact = {
  filePath: string;
  artifact: ExportArtifactDescriptor;
};

async function putSignedObject(input: {
  uploadUrl: string;
  headers: Record<string, string>;
  filePath: string;
  contentLength: number;
}) {
  const bodyStream = Readable.toWeb(createReadStream(input.filePath));
  const requestInit: RequestInit & { duplex: "half" } = {
    method: "PUT",
    headers: {
      ...input.headers,
      "content-length": String(input.contentLength),
    },
    body: bodyStream as unknown as BodyInit,
    duplex: "half",
  };
  const response = await fetch(input.uploadUrl, requestInit);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to upload artifact: ${response.status}${text ? ` ${text}` : ""}`,
    );
  }
}

export async function uploadArtifactToStorage(
  input: ArtifactUploadInput,
): Promise<UploadedArtifact> {
  const adapter = createR2StorageAdapterFromEnv(process.env);
  const fileStat = await stat(input.filePath);
  const signedUpload = await adapter.createSignedUpload({
    key: input.artifact.storageKey,
    contentType: input.artifact.mimeType ?? "application/octet-stream",
  });

  await putSignedObject({
    uploadUrl: signedUpload.uploadUrl,
    headers: signedUpload.headers,
    filePath: input.filePath,
    contentLength: fileStat.size,
  });

  return {
    filePath: input.filePath,
    artifact: {
      ...input.artifact,
      byteSize: fileStat.size,
    },
  };
}
