import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

function findDotEnvPath() {
  let currentDir = process.cwd();

  for (let index = 0; index < 5; index += 1) {
    const envPath = join(currentDir, ".env");

    if (existsSync(envPath)) {
      return envPath;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return null;
}

function loadDotEnv() {
  const envPath = findDotEnvPath();

  if (!envPath) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value.replace(/^['"]|['"]$/gu, "");
  }
}

function parseNumberArg(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric argument: ${value}`);
  }

  return parsed;
}

function parseOptions(argv) {
  const flags = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      flags.set(token, "true");
      continue;
    }

    flags.set(token, next);
    index += 1;
  }

  return {
    baseUrl:
      flags.get("--base-url") ??
      process.env.WEB_BASE_URL ??
      "http://127.0.0.1:3000",
    durationMs: parseNumberArg(flags.get("--duration-ms"), 1_000),
    width: parseNumberArg(flags.get("--width"), 320),
    height: parseNumberArg(flags.get("--height"), 180),
    fps: parseNumberArg(flags.get("--fps"), 12),
    timeoutMs: parseNumberArg(flags.get("--timeout-ms"), 180_000),
    pollIntervalMs: parseNumberArg(flags.get("--poll-interval-ms"), 1_000),
  };
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload.error?.message ?? `Request failed with ${response.status}.`;
  } catch {
    return `Request failed with ${response.status}.`;
  }
}

async function requestJson(baseUrl, path, init) {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

function createMinimalProject(project, options) {
  const nextProject = structuredClone(project);

  nextProject.meta.name = "Export Smoke Test";
  nextProject.meta.description = "Minimal backend rendering smoke test fixture.";
  nextProject.meta.tags = ["smoke-test"];
  nextProject.timing.durationMs = options.durationMs;
  nextProject.timing.fps = options.fps;
  nextProject.viewport.width = options.width;
  nextProject.viewport.height = options.height;
  nextProject.viewport.aspectRatio = "16:9";
  nextProject.viewport.backgroundColor = "#111111";
  nextProject.audio.assetId = null;
  nextProject.audio.source = null;
  nextProject.audio.analysisId = null;
  nextProject.backdrop.source = null;
  nextProject.backdrop.bounceEnabled = false;
  nextProject.backdrop.shakeEnabled = false;
  nextProject.backdrop.filterEnabled = false;
  nextProject.backdrop.vignetteEnabled = false;
  nextProject.backdrop.contrastEnabled = false;
  nextProject.backdrop.zoomBlurEnabled = false;
  nextProject.visualizer.enabled = false;
  nextProject.visualizer.logoVisible = false;
  nextProject.overlays.particles.enabled = false;
  nextProject.overlays.particles.speedUpEnabled = false;
  nextProject.overlays.youTubeCta.enabled = false;
  nextProject.overlays.emojiImages = [];
  nextProject.lyrics.segments = [];
  nextProject.textLayers = [];
  nextProject.updatedAt = new Date().toISOString();

  return nextProject;
}

function isTerminalStatus(status) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function summarizeEvents(job) {
  return job.events
    .slice(-8)
    .map((event) => {
      const progress =
        typeof event.progress === "number" ? ` ${event.progress}%` : "";
      const message = event.message ? ` ${event.message}` : "";

      return `${event.createdAt} ${event.type}${progress}${message}`;
    })
    .join("\n");
}

async function verifyArtifact(storageKey) {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!publicBaseUrl) {
    return {
      storageKey,
      publicUrl: null,
      contentLength: null,
      contentType: null,
      verifiedBy: "storageKey-only",
    };
  }

  const artifactUrl = new URL(
    storageKey,
    `${publicBaseUrl.replace(/\/$/u, "")}/`,
  ).toString();
  const response = await fetch(artifactUrl, {
    method: "HEAD",
  });

  if (!response.ok) {
    throw new Error(
      `Artifact ${storageKey} was not reachable at ${artifactUrl}: ${response.status}.`,
    );
  }

  return {
    storageKey,
    publicUrl: artifactUrl,
    contentLength: response.headers.get("content-length"),
    contentType: response.headers.get("content-type"),
    verifiedBy: "public-url-head",
  };
}

async function main() {
  loadDotEnv();

  const options = parseOptions(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  console.log("Starting export smoke test.", {
    baseUrl: options.baseUrl,
    width: options.width,
    height: options.height,
    fps: options.fps,
    durationMs: options.durationMs,
    timeoutMs: options.timeoutMs,
  });

  const createdProject = await requestJson(options.baseUrl, "/api/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: `Smoke Export ${startedAt}`,
      description: "Auto-generated by apps/web/scripts/export-smoke.mjs",
    }),
  });
  const projectId = createdProject.project.id;
  const initialProjectData = createdProject.activeProject;
  const initialSnapshot = createdProject.activeSnapshot;

  if (!initialProjectData || !initialSnapshot) {
    throw new Error(`Project ${projectId} did not return an active snapshot.`);
  }

  const projectData = createMinimalProject(initialProjectData, options);
  const savedSnapshot = await requestJson(
    options.baseUrl,
    `/api/projects/${projectId}/save`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectData,
        source: "smoke-test",
        reason: "minimal-export-smoke",
      }),
    },
  );

  console.log("Created minimal smoke project.", {
    projectId,
    snapshotId: savedSnapshot.snapshot.id,
  });

  const createdExport = await requestJson(options.baseUrl, "/api/exports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      snapshotId: savedSnapshot.snapshot.id,
      format: "mp4",
      width: options.width,
      height: options.height,
      fps: options.fps,
      durationMs: options.durationMs,
      metadata: {
        smokeTest: true,
        startedAt,
      },
    }),
  });
  const exportJobId = createdExport.job.id;

  console.log("Created export job.", {
    exportJobId,
    status: createdExport.job.status,
  });

  const deadline = Date.now() + options.timeoutMs;
  let lastProgressMessage = "";
  let finalJob = createdExport;

  while (Date.now() < deadline) {
    const current = await requestJson(
      options.baseUrl,
      `/api/exports/${exportJobId}`,
    );
    finalJob = current;

    const progressMessage = [
      current.job.status,
      current.job.progress,
      current.events.at(-1)?.type ?? "",
      current.events.at(-1)?.message ?? "",
    ].join("|");

    if (progressMessage !== lastProgressMessage) {
      lastProgressMessage = progressMessage;
      console.log("Export progress.", {
        exportJobId,
        status: current.job.status,
        progress: current.job.progress,
        updatedAt: current.job.updatedAt,
        lastEvent: current.events.at(-1)?.type ?? null,
        message: current.events.at(-1)?.message ?? null,
      });
    }

    if (isTerminalStatus(current.job.status)) {
      break;
    }

    await delay(options.pollIntervalMs);
  }

  if (!isTerminalStatus(finalJob.job.status)) {
    throw new Error(
      [
        `Export job ${exportJobId} did not reach a terminal state before timeout.`,
        summarizeEvents(finalJob) || "No events were recorded.",
      ].join("\n"),
    );
  }

  if (finalJob.job.status !== "completed") {
    throw new Error(
      [
        `Export job ${exportJobId} finished as ${finalJob.job.status}.`,
        finalJob.job.errorCode
          ? `errorCode=${finalJob.job.errorCode}`
          : "errorCode=<none>",
        finalJob.job.errorMessage
          ? `errorMessage=${finalJob.job.errorMessage}`
          : "errorMessage=<none>",
        summarizeEvents(finalJob) || "No events were recorded.",
      ].join("\n"),
    );
  }

  if (!finalJob.job.outputStorageKey) {
    throw new Error(`Export job ${exportJobId} completed without outputStorageKey.`);
  }

  const artifact = await verifyArtifact(finalJob.job.outputStorageKey);

  console.log("Smoke export completed.", {
    exportJobId,
    outputStorageKey: artifact.storageKey,
    contentLength: artifact.contentLength,
    contentType: artifact.contentType,
    publicUrl: artifact.publicUrl,
    verifiedBy: artifact.verifiedBy,
    posterStorageKey: finalJob.job.posterStorageKey,
  });
}

void main().catch((error) => {
  console.error(
    "Export smoke test failed.",
    error instanceof Error ? error.stack ?? error.message : error,
  );
  process.exit(1);
});
