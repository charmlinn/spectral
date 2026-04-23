import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { RenderSession } from "@spectral/render-session";

import type { MaterializedRenderAudioAnalysis } from "./contracts";

export async function materializeAudioAnalysis(input: {
  audioAnalysis: RenderSession["assets"]["audioAnalysis"];
  workspaceDir: string;
}): Promise<MaterializedRenderAudioAnalysis | null> {
  const audioAnalysis = input.audioAnalysis;

  if (!audioAnalysis) {
    return null;
  }

  if (!audioAnalysis.snapshot) {
    return {
      analysisId: audioAnalysis.analysisId,
      snapshot: null,
      snapshotPath: null,
    };
  }

  const analysisDir = join(input.workspaceDir, "analysis");
  await mkdir(analysisDir, { recursive: true });

  const snapshotPath = join(analysisDir, "audio-analysis.json");
  await writeFile(snapshotPath, `${JSON.stringify(audioAnalysis.snapshot, null, 2)}\n`, "utf8");

  return {
    analysisId: audioAnalysis.analysisId,
    snapshot: audioAnalysis.snapshot,
    snapshotPath,
  };
}
