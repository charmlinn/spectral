import type { TimelineLyricsSegment } from "../types";

function createDerivedSegmentId(segmentId: string, suffix: string): string {
  return `${segmentId}-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function splitTimelineSegment(
  segment: TimelineLyricsSegment,
  splitAtMs: number,
): [TimelineLyricsSegment, TimelineLyricsSegment] {
  if (splitAtMs <= segment.startMs || splitAtMs >= segment.endMs) {
    throw new Error(
      `Split time ${splitAtMs}ms must be inside segment ${segment.id} (${segment.startMs}-${segment.endMs}).`,
    );
  }

  return [
    {
      ...segment,
      id: createDerivedSegmentId(segment.id, "a"),
      endMs: splitAtMs,
    },
    {
      ...segment,
      id: createDerivedSegmentId(segment.id, "b"),
      startMs: splitAtMs,
    },
  ];
}

export function duplicateTimelineSegment(
  segment: TimelineLyricsSegment,
  durationMs: number,
): TimelineLyricsSegment {
  const segmentDuration = segment.endMs - segment.startMs;
  const startMs = Math.min(durationMs - segmentDuration, segment.endMs + 80);
  const endMs = Math.min(durationMs, startMs + segmentDuration);

  return {
    ...segment,
    id: createDerivedSegmentId(segment.id, "copy"),
    startMs,
    endMs,
  };
}

export function replaceTimelineSegment(
  segments: TimelineLyricsSegment[],
  nextSegment: TimelineLyricsSegment,
): TimelineLyricsSegment[] {
  return segments.map((segment) => (segment.id === nextSegment.id ? nextSegment : segment));
}

export function removeTimelineSegment(
  segments: TimelineLyricsSegment[],
  segmentId: string,
): TimelineLyricsSegment[] {
  return segments.filter((segment) => segment.id !== segmentId);
}
