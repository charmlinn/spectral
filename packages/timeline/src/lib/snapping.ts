export function findNearestSnapTime(
  targetMs: number,
  snapPointsMs: number[],
  thresholdMs: number,
): number {
  let nearest = targetMs;
  let minDistance = thresholdMs;

  for (const snapPointMs of snapPointsMs) {
    const distance = Math.abs(snapPointMs - targetMs);

    if (distance <= minDistance) {
      minDistance = distance;
      nearest = snapPointMs;
    }
  }

  return nearest;
}
