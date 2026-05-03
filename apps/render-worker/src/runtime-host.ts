import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OFFLINE_BUNDLE_RELATIVE_PATH =
  "packages/render-runtime-browser/dist/offline/spectral-offline-runtime.bundle.js";

function resolveOfflineRuntimeBundlePath(): string {
  const configured = process.env.SPECTRAL_OFFLINE_RUNTIME_BUNDLE;

  if (configured && existsSync(configured)) {
    return configured;
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), OFFLINE_BUNDLE_RELATIVE_PATH),
    resolve(process.cwd(), "../../", OFFLINE_BUNDLE_RELATIVE_PATH),
    resolve(currentDir, "../../../", OFFLINE_BUNDLE_RELATIVE_PATH),
  ];
  const matched = candidates.find((candidate) => existsSync(candidate));

  if (!matched) {
    throw new Error(
      `Spectral offline runtime bundle is missing. Run "pnpm --filter @spectral/render-runtime-browser build:offline" first.`,
    );
  }

  return matched;
}

function createRuntimeHostHtml(bundleUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #stage {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }

      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <div id="stage"></div>
    <script type="module" src="${bundleUrl}"></script>
  </body>
</html>`;
}

export async function createOfflineRuntimeHost(input: {
  workDir: string;
}): Promise<{
  bundlePath: string;
  hostPath: string;
  hostUrl: string;
}> {
  const bundlePath = resolveOfflineRuntimeBundlePath();
  const hostDir = resolve(input.workDir, "runtime-host");
  const hostPath = resolve(hostDir, "index.html");
  const bundleUrl = pathToFileURL(bundlePath).href;

  await mkdir(hostDir, { recursive: true });
  await writeFile(hostPath, createRuntimeHostHtml(bundleUrl), "utf8");

  return {
    bundlePath,
    hostPath,
    hostUrl: pathToFileURL(hostPath).href,
  };
}
