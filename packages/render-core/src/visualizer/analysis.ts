import { EMPTY_AUDIO_FREQUENCY } from "@spectral/audio-analysis";
import type { AudioAnalysisProvider } from "@spectral/audio-analysis";

import type { RenderFrameContext } from "../contracts/render";

export function getSpectrumForFrame(
  provider: AudioAnalysisProvider | null | undefined,
  frameContext: RenderFrameContext,
): Float32Array {
  if (!provider) {
    return new Float32Array(EMPTY_AUDIO_FREQUENCY);
  }

  return provider.getSpectrumAtFrame(frameContext.frame);
}

export function getAverageAmplitude(values: Float32Array): number {
  if (values.length === 0) {
    return 0;
  }

  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total / values.length;
}
