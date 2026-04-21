import { disconnectPrismaClient, getPrismaClient } from "../client/index";
import { importBundledLegacyPresets } from "./import-legacy-presets";

async function main() {
  const db = getPrismaClient();
  await importBundledLegacyPresets(db);
  await disconnectPrismaClient();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectPrismaClient();
  process.exitCode = 1;
});
