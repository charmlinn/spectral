import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function createMaterializationWorkspace(
  prefix = "spectral-render-assets-",
  parentDir?: string,
): Promise<string> {
  return mkdtemp(join(parentDir ?? tmpdir(), prefix));
}
