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
  redisUrl: string;
  redisQueuePrefix?: string;
  exportWorkerConcurrency: number;
  databaseUrl: string;
  webBaseUrl: string;
  internalExportsToken?: string;
  renderTempDir?: string;
} | null = null;

export function getWorkerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    redisUrl: readRequired("REDIS_URL"),
    redisQueuePrefix: process.env.REDIS_QUEUE_PREFIX,
    exportWorkerConcurrency: readNumber("EXPORT_WORKER_CONCURRENCY", 1),
    databaseUrl: readRequired("DATABASE_URL"),
    webBaseUrl: readRequired("WEB_BASE_URL"),
    internalExportsToken: process.env.INTERNAL_EXPORTS_TOKEN,
    renderTempDir: process.env.RENDER_TEMP_DIR,
  };

  return cachedEnv;
}
