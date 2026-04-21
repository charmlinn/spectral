import { startRenderWorker } from "./worker";

void startRenderWorker().catch((error) => {
  console.error("Failed to start render worker.", error);
  process.exit(1);
});
