import { R2StorageAdapter, type R2StorageAdapterOptions } from "./r2-storage-adapter";

export type R2Environment = {
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_REGION?: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_PUBLIC_BASE_URL?: string;
  R2_FORCE_PATH_STYLE?: string;
};

export function createR2StorageAdapterFromEnv(env: R2Environment): R2StorageAdapter {
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required to create the R2 adapter.",
    );
  }

  const options: R2StorageAdapterOptions = {
    accountId: env.R2_ACCOUNT_ID,
    bucket,
    region: env.R2_REGION,
    endpoint: env.R2_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? null,
    forcePathStyle: env.R2_FORCE_PATH_STYLE === "true",
  };

  return new R2StorageAdapter(options);
}
