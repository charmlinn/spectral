import React, { useEffect, useRef } from "react";

import type { TimelineGridProps } from "../types";
import { getNiceTickStepMs, getTimelineWidth, msToPixels } from "../lib/time";

export function TimelineGrid({ durationMs, pxPerSecond, height }: TimelineGridProps) {
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
    context.fillStyle = "#14161a";
    context.fillRect(0, 0, width, height);

    const tickStepMs = getNiceTickStepMs(pxPerSecond);

    for (let timeMs = 0; timeMs <= durationMs; timeMs += tickStepMs / 2) {
      const x = Math.round(msToPixels(timeMs, pxPerSecond)) + 0.5;
      const isMajor = timeMs % tickStepMs === 0;
      context.strokeStyle = isMajor ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)";
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
  }, [durationMs, height, pxPerSecond, width]);

  return <canvas ref={canvasRef} style={{ display: "block", width, height }} />;
}
