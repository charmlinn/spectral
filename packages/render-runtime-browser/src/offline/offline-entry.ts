import { createSpectralOfflineRuntime } from "./runtime-api";

export async function initializeSpectralOfflineRuntimeOnWindow() {
  const target = document.getElementById("stage");

  if (!(target instanceof HTMLElement)) {
    throw new Error("Offline render host is missing #stage.");
  }

  window.spectralRuntime = createSpectralOfflineRuntime({
    target,
  });
}

window.__spectralOfflineRuntimeReady = initializeSpectralOfflineRuntimeOnWindow();
