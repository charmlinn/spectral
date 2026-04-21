function readRequired(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
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
    throw new Error(`Environment variable ${name} must be a number.`);
  }

  return parsed;
}

let cachedEnv: {
  amqpUrl: string;
  amqpPrefetch: number;
  amqpRetryDelayMs: number;
  databaseUrl: string;
  exportMaxAttempts: number;
  webBaseUrl: string;
} | null = null;

export function getWorkerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    amqpUrl: readRequired("AMQP_URL"),
    amqpPrefetch: readNumber("AMQP_PREFETCH", 1),
    amqpRetryDelayMs: readNumber("AMQP_RETRY_DELAY_MS", 30_000),
    databaseUrl: readRequired("DATABASE_URL"),
    exportMaxAttempts: readNumber("EXPORT_MAX_ATTEMPTS", 3),
    webBaseUrl: readRequired("WEB_BASE_URL"),
  };

  return cachedEnv;
}
