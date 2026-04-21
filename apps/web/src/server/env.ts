import { badRequest } from "./errors";

type ServerEnv = {
  amqpUrl: string;
  amqpRetryDelayMs: number;
  amqpPrefetch: number;
  exportMaxAttempts: number;
  r2AccountId?: string;
  r2Bucket: string;
  r2Region?: string;
  r2Endpoint?: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2PublicBaseUrl?: string;
  ssePollIntervalMs: number;
  sseHeartbeatIntervalMs: number;
};

let cachedEnv: ServerEnv | null = null;

function readRequired(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw badRequest(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw badRequest(`Environment variable ${name} must be a number.`);
  }

  return parsed;
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    amqpUrl: readRequired("AMQP_URL"),
    amqpRetryDelayMs: readNumber("AMQP_RETRY_DELAY_MS", 30_000),
    amqpPrefetch: readNumber("AMQP_PREFETCH", 1),
    exportMaxAttempts: readNumber("EXPORT_MAX_ATTEMPTS", 3),
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2Bucket: readRequired("R2_BUCKET"),
    r2Region: process.env.R2_REGION,
    r2Endpoint: process.env.R2_ENDPOINT,
    r2AccessKeyId: readRequired("R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: readRequired("R2_SECRET_ACCESS_KEY"),
    r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    ssePollIntervalMs: readNumber("SSE_POLL_INTERVAL_MS", 1_000),
    sseHeartbeatIntervalMs: readNumber("SSE_HEARTBEAT_INTERVAL_MS", 15_000),
  };

  return cachedEnv;
}
