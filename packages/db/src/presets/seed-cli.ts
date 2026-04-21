import { disconnectDataLayer, getDataLayer } from "../client/index";
import { importBundledLegacyPresets } from "./import-legacy-presets";

async function main() {
  const dataLayer = getDataLayer();
  await importBundledLegacyPresets(dataLayer.presetRepository);
  await disconnectDataLayer();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDataLayer();
  process.exitCode = 1;
});
