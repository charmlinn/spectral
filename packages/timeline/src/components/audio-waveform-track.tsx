import React, { useEffect, useRef } from "react";

import type { WaveformPoint } from "@spectral/audio-analysis";

import { getTimelineWidth, msToPixels } from "../lib/time";
import type { AudioWaveformTrackProps } from "../types";

type ResampledWaveformPoint = {
  min: number;
  max: number;
  amplitude: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getWaveformAmplitude(point: WaveformPoint) {
  const peak = Math.max(Math.abs(point.min), Math.abs(point.max));
  const spread = Math.abs(point.max - point.min) * 0.5;
  return clamp((peak * 0.7 + spread * 0.3) ** 0.72, 0, 1);
}

// Width-driven resampling keeps the waveform legible while timeline zoom changes.
function resampleWaveform(
  points: WaveformPoint[],
  targetPoints: number,
): ResampledWaveformPoint[] {
  if (points.length === 0 || targetPoints <= 0) {
    return [];
  }

  const safeTargetPoints = Math.max(1, targetPoints);
  const step = points.length / safeTargetPoints;
  const resampled: ResampledWaveformPoint[] = [];

  for (let index = 0; index < safeTargetPoints; index += 1) {
    const start = Math.floor(index * step);
    const end = Math.max(start + 1, Math.floor((index + 1) * step));
    const slice = points.slice(start, end);

    if (slice.length === 0) {
      continue;
    }

    let min = 1;
    let max = -1;
    let amplitude = 0;

    for (const point of slice) {
      min = Math.min(min, point.min);
      max = Math.max(max, point.max);
      amplitude = Math.max(amplitude, getWaveformAmplitude(point));
    }

    resampled.push({
      min,
      max,
      amplitude,
    });
  }

  return resampled;
}

function drawRoundedBar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export function AudioWaveformTrack({
  currentTimeMs,
  durationMs,
  pxPerSecond,
  waveform,
  height = 104,
}: AudioWaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = Math.ceil(getTimelineWidth(durationMs, pxPerSecond));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const backgroundGradient = context.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "#17191f");
    backgroundGradient.addColorStop(0.5, "#111318");
    backgroundGradient.addColorStop(1, "#0c0e12");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,0.025)";
    context.fillRect(0, 0, width, 26);
    context.fillStyle = "rgba(255,255,255,0.018)";
    context.fillRect(0, height - 24, width, 24);

    const warmOverlay = context.createLinearGradient(0, 0, width, 0);
    warmOverlay.addColorStop(0, "rgba(249,115,22,0.08)");
    warmOverlay.addColorStop(0.4, "rgba(249,115,22,0.03)");
    warmOverlay.addColorStop(1, "rgba(249,115,22,0)");
    context.fillStyle = warmOverlay;
    context.fillRect(0, 0, width, height);

    const middle = height / 2;
    context.strokeStyle = "rgba(255,255,255,0.07)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, middle + 0.5);
    context.lineTo(width, middle + 0.5);
    context.stroke();

    if (!waveform || waveform.points.length === 0) {
      return;
    }

    const targetColumns = Math.max(
      80,
      Math.floor(width / Math.max(1.4, pxPerSecond / 150)),
    );
    const points = resampleWaveform(waveform.points, targetColumns);
    const step = width / Math.max(1, points.length);
    const currentX = msToPixels(currentTimeMs, pxPerSecond);

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (!point) {
        continue;
      }

      const x = index * step;
      const columnWidth = Math.max(1, step - 1);
      const amplitude = clamp(point.amplitude, 0, 1);
      const barHeight = Math.max(4, amplitude * (height * 0.78));
      const y = middle - barHeight / 2;
      const isPlayed = x <= currentX;
      const baseAlpha = isPlayed ? 0.42 : 0.16;

      context.fillStyle = isPlayed
        ? `rgba(249, 115, 22, ${baseAlpha})`
        : `rgba(255, 255, 255, ${baseAlpha})`;
      drawRoundedBar(
        context,
        x,
        y,
        columnWidth,
        barHeight,
        Math.min(4, columnWidth / 2),
      );
      context.fill();

      const innerWidth = Math.max(1, columnWidth * 0.68);
      const innerHeight = Math.max(3, barHeight * 0.72);
      const innerX = x + (columnWidth - innerWidth) / 2;
      const innerY = middle - innerHeight / 2;
      context.fillStyle = isPlayed
        ? "rgba(253, 186, 116, 0.92)"
        : "rgba(255, 255, 255, 0.34)";
      drawRoundedBar(
        context,
        innerX,
        innerY,
        innerWidth,
        innerHeight,
        Math.min(3, innerWidth / 2),
      );
      context.fill();
    }

    const playedGradient = context.createLinearGradient(0, 0, currentX, 0);
    playedGradient.addColorStop(0, "rgba(251, 146, 60, 0.14)");
    playedGradient.addColorStop(1, "rgba(249, 115, 22, 0.025)");
    context.fillStyle = playedGradient;
    context.fillRect(0, 0, clamp(currentX, 0, width), height);
  }, [currentTimeMs, durationMs, height, pxPerSecond, waveform, width]);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width, height }} />
      <div
        style={{
          position: "absolute",
          inset: "10px auto auto 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(226,232,240,0.7)",
          }}
        >
          Audio
        </span>
        <span
          style={{
            fontSize: 11,
            color: "rgba(148,163,184,0.8)",
          }}
        >
          Waveform
        </span>
      </div>
    </div>
  );
}
