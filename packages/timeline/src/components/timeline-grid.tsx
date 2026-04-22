import React, { useEffect, useRef } from "react";

import type { TimelineGridProps } from "../types";
import { getNiceTickStepMs, getTimelineWidth, msToPixels } from "../lib/time";

export function TimelineGrid({
  durationMs,
  pxPerSecond,
  height,
}: TimelineGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = Math.ceil(getTimelineWidth(durationMs, pxPerSecond));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);
    const backgroundGradient = context.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "rgba(18,21,28,0.84)");
    backgroundGradient.addColorStop(1, "rgba(10,12,18,0.92)");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(255,255,255,0.035)";
    context.beginPath();
    context.moveTo(0, 104.5);
    context.lineTo(width, 104.5);
    context.stroke();

    const tickStepMs = getNiceTickStepMs(pxPerSecond);

    for (let timeMs = 0; timeMs <= durationMs; timeMs += tickStepMs / 2) {
      const x = Math.round(msToPixels(timeMs, pxPerSecond)) + 0.5;
      const isMajor = timeMs % tickStepMs === 0;
      context.strokeStyle = isMajor
        ? "rgba(255,255,255,0.11)"
        : "rgba(255,255,255,0.045)";
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
  }, [durationMs, height, pxPerSecond, width]);

  return <canvas ref={canvasRef} style={{ display: "block", width, height }} />;
}
