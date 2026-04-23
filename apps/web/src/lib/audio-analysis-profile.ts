import { AUDIO_ANALYZER_CONSTANTS } from "@spectral/audio-analysis";

import type { AudioAnalysisDto } from "./editor-api";

export const EDITOR_AUDIO_ANALYZER_VERSION = "spectral-browser-v2";

export function isCompatibleEditorAudioAnalysis(
  analysis: AudioAnalysisDto,
  fps: number,
): boolean {
  const metadata = analysis.metadata ?? {};
  const analysisFps =
    typeof metadata.fps === "number" && metadata.fps > 0 ? metadata.fps : null;
  const maxMagnitudeAnalysisFps =
    typeof metadata.maxMagnitudeAnalysisFps === "number" &&
    metadata.maxMagnitudeAnalysisFps > 0
      ? metadata.maxMagnitudeAnalysisFps
      : null;

  return (
    analysis.analyzerVersion === EDITOR_AUDIO_ANALYZER_VERSION &&
    analysisFps === fps &&
    maxMagnitudeAnalysisFps ===
      AUDIO_ANALYZER_CONSTANTS.maxMagnitudeAnalysisFps
  );
}
