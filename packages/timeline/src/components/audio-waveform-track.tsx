import React, { useEffect, useRef } from "react";

import type { AudioWaveformTrackProps } from "../types";
import { getTimelineWidth } from "../lib/time";

export function AudioWaveformTrack({
  durationMs,
  pxPerSecond,
  waveform,
  height = 96,
}: AudioWaveformTrackProps) {
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
    context.fillStyle = "#101114";
    context.fillRect(0, 0, width, height);

    if (!waveform || waveform.points.length === 0) {
      return;
    }

    const middle = height / 2;
    const step = width / waveform.points.length;
    context.strokeStyle = "#38bdf8";
    context.lineWidth = Math.max(1, step * 0.8);
    context.beginPath();

    for (let index = 0; index < waveform.points.length; index += 1) {
      const point = waveform.points[index]!;
      const x = index * step;
      context.moveTo(x, middle - (point.max * middle * 0.85));
      context.lineTo(x, middle - (point.min * middle * 0.85));
    }

    context.stroke();
  }, [durationMs, height, pxPerSecond, waveform, width]);

  return <canvas ref={canvasRef} style={{ display: "block", width, height }} />;
}
