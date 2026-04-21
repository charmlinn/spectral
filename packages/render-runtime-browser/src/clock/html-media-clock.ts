import { timeMsToFrame, type RenderClock } from "@spectral/render-core";

export function createHtmlMediaElementClock(
  mediaElement: HTMLMediaElement,
  fps: number,
): RenderClock {
  return {
    getCurrentTimeMs() {
      return mediaElement.currentTime * 1000;
    },
    getCurrentFrame() {
      return timeMsToFrame(mediaElement.currentTime * 1000, fps);
    },
    seekToMs(ms: number) {
      mediaElement.currentTime = ms / 1000;
    },
  };
}
