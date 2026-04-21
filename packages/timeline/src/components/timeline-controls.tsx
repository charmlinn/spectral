import React from "react";

type TimelineControlsProps = {
  pxPerSecond: number;
  minPxPerSecond: number;
  maxPxPerSecond: number;
  onZoomChange?(pxPerSecond: number): void;
};

export function TimelineControls({
  pxPerSecond,
  minPxPerSecond,
  maxPxPerSecond,
  onZoomChange,
}: TimelineControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        color: "#f4f4f5",
        background: "#121316",
      }}
    >
      <button
        type="button"
        onClick={() => onZoomChange?.(Math.max(minPxPerSecond, pxPerSecond * 0.9))}
      >
        -
      </button>
      <span style={{ minWidth: 72, textAlign: "center", fontSize: 12 }}>
        {Math.round(pxPerSecond)} px/s
      </span>
      <button
        type="button"
        onClick={() => onZoomChange?.(Math.min(maxPxPerSecond, pxPerSecond * 1.1))}
      >
        +
      </button>
    </div>
  );
}
