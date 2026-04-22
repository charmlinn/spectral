import React from "react";

type TimelineControlsProps = {
  pxPerSecond: number;
  minPxPerSecond: number;
  maxPxPerSecond: number;
  selectedSegmentLabel?: string | null;
  onZoomChange?(pxPerSecond: number): void;
  onSplitSelected?(): void;
  onDuplicateSelected?(): void;
  onDeleteSelected?(): void;
};

export function TimelineControls({
  pxPerSecond,
  minPxPerSecond,
  maxPxPerSecond,
  selectedSegmentLabel,
  onZoomChange,
  onSplitSelected,
  onDuplicateSelected,
  onDeleteSelected,
}: TimelineControlsProps) {
  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    height: 28,
    paddingInline: 10,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#e4e4e7",
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        color: "#f4f4f5",
        background: "linear-gradient(180deg, #14171d 0%, #101319 100%)",
      }}
    >
      <button
        type="button"
        onClick={() =>
          onZoomChange?.(Math.max(minPxPerSecond, pxPerSecond * 0.9))
        }
        style={buttonStyle}
      >
        -
      </button>
      <span
        style={{
          minWidth: 86,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "#cbd5e1",
        }}
      >
        {Math.round(pxPerSecond)} px/s
      </span>
      <button
        type="button"
        onClick={() =>
          onZoomChange?.(Math.min(maxPxPerSecond, pxPerSecond * 1.1))
        }
        style={buttonStyle}
      >
        +
      </button>
      {selectedSegmentLabel ? (
        <>
          <span
            style={{
              marginInlineStart: 12,
              fontSize: 12,
              color: "#a1a1aa",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 180,
            }}
          >
            {selectedSegmentLabel}
          </span>
          <button type="button" onClick={onSplitSelected} style={buttonStyle}>
            Split
          </button>
          <button
            type="button"
            onClick={onDuplicateSelected}
            style={buttonStyle}
          >
            Duplicate
          </button>
          <button type="button" onClick={onDeleteSelected} style={buttonStyle}>
            Delete
          </button>
        </>
      ) : null}
    </div>
  );
}
