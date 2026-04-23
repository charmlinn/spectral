import type { SelectRenderSampleFramesInput, RenderParitySample } from "./contracts";

function clampFrame(frame: number, frameCount: number): number {
  return Math.max(0, Math.min(Math.max(0, frameCount - 1), Math.floor(frame)));
}

export function selectRenderSampleFrames(
  input: SelectRenderSampleFramesInput,
): RenderParitySample[] {
  const fallbackFrames = [
    0,
    Math.max(0, Math.floor((input.session.runtime.frameCount - 1) / 2)),
    Math.max(0, input.session.runtime.frameCount - 1),
  ];
  const selectedFrames =
    input.session.diagnostics.sampleFrames.length > 0
      ? input.session.diagnostics.sampleFrames
      : fallbackFrames;
  const dedupedFrames = [...new Set(selectedFrames)]
    .map((frame) => clampFrame(frame, input.session.runtime.frameCount))
    .sort((left, right) => left - right)
    .slice(0, Math.max(1, input.maxSamples ?? selectedFrames.length));

  return dedupedFrames.map((frame) => ({
    frame,
    timeMs: Math.min(
      input.session.runtime.durationMs,
      Math.round((frame / Math.max(1, input.session.runtime.fps)) * 1000),
    ),
  }));
}
