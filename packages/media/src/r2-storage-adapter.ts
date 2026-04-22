import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  CreateSignedUploadInput,
  SignedReadInput,
  SignedUpload,
  StorageAdapter,
} from "./contracts";

export type R2StorageAdapterOptions = {
  accountId?: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string | null;
  forcePathStyle?: boolean;
};

export class R2StorageAdapter implements StorageAdapter {
  readonly bucket: string;
  readonly #client: S3Client;
  readonly #publicBaseUrl: string | null;

  constructor(options: R2StorageAdapterOptions) {
    const endpoint =
      options.endpoint ??
      (options.accountId
        ? `https://${options.accountId}.r2.cloudflarestorage.com`
        : undefined);

    if (!endpoint) {
      throw new Error("R2 endpoint or accountId is required.");
    }

    this.bucket = options.bucket;
    this.#publicBaseUrl = options.publicBaseUrl ?? null;
    this.#client = new S3Client({
      region: options.region ?? "auto",
      endpoint,
      forcePathStyle: options.forcePathStyle ?? false,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async createSignedUpload(input: CreateSignedUploadInput): Promise<SignedUpload> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
      Metadata: input.metadata,
    });
    const uploadUrl = await getSignedUrl(this.#client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      key: input.key,
      bucket: this.bucket,
      uploadUrl,
      method: "PUT",
      headers: {
        "content-type": input.contentType,
      },
      expiresInSeconds,
    };
  }

  async createSignedReadUrl(input: SignedReadInput): Promise<string> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
    });

    return getSignedUrl(this.#client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async putJson(
    key: string,
    payload: unknown,
    contentType = "application/json; charset=utf-8",
  ): Promise<void> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.#client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async headObject(key: string) {
    try {
      const result = await this.#client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        etag: result.ETag,
        lastModified: result.LastModified,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.toLowerCase().includes("not found")) {
        return null;
      }

      throw error;
    }
  }

  resolvePublicUrl(key: string): string | null {
    if (!this.#publicBaseUrl) {
      return null;
    }

    return new URL(key, `${this.#publicBaseUrl.replace(/\/$/, "")}/`).toString();
  }
}
