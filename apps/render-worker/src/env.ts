import { hostname, tmpdir } from "node:os";
import { join } from "node:path";

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

function resolveChromiumExecutablePath(): string {
  return (
    process.env.CHROMIUM_BIN ??
    process.env.CHROME_BIN ??
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "google-chrome")
  );
}

let cachedEnv: {
  redisUrl: string;
  redisQueuePrefix?: string;
  exportWorkerConcurrency: number;
  webBaseUrl: string;
  internalExportsToken: string;
  workerId: string;
  heartbeatIntervalMs: number;
  cancelPollIntervalMs: number;
  workRootDir: string;
  chromiumExecutablePath: string;
  ffmpegBin: string;
} | null = null;

export function getWorkerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    redisUrl: readRequired("REDIS_URL"),
    redisQueuePrefix: process.env.REDIS_QUEUE_PREFIX,
    exportWorkerConcurrency: readNumber("EXPORT_WORKER_CONCURRENCY", 1),
    webBaseUrl: readRequired("WEB_BASE_URL"),
    internalExportsToken: readRequired("INTERNAL_EXPORTS_TOKEN"),
    workerId: process.env.EXPORT_WORKER_ID ?? `${hostname()}-${process.pid}`,
    heartbeatIntervalMs: Math.max(
      1_000,
      readNumber("EXPORT_HEARTBEAT_INTERVAL_MS", 15_000),
    ),
    cancelPollIntervalMs: Math.max(
      1_000,
      readNumber("EXPORT_CANCEL_POLL_INTERVAL_MS", 5_000),
    ),
    workRootDir:
      process.env.EXPORT_WORK_ROOT ?? join(tmpdir(), "spectral-renders"),
    chromiumExecutablePath: resolveChromiumExecutablePath(),
    ffmpegBin: process.env.FFMPEG_BIN ?? "ffmpeg",
  };

  return cachedEnv;
}
