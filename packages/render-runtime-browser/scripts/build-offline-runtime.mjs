import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [resolve(packageRoot, "src/offline/offline-entry.ts")],
  outfile: resolve(
    packageRoot,
    "dist/offline/spectral-offline-runtime.bundle.js",
  ),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome120"],
  sourcemap: true,
  logLevel: "info",
});
