import { clamp } from "../canvas-utils";

function normalizeFlatReflectionType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "none";

  if (normalized.includes("combo")) {
    return "combo";
  }

  if (normalized.includes("2 side") || normalized.includes("two side")) {
    return "2 sides";
  }

  if (normalized.includes("1 side") || normalized.includes("one side")) {
    return "1 side";
  }

  return "none";
}

export function buildFlatWavePoints(
  spectrum: number[],
  width: number,
  baseHeight: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
  waveStyle: string,
) {
  const points: number[] = [];
  const magnitudePercents: number[] = [];
  const reflection = normalizeFlatReflectionType(reflectionType);
  const values = inverted ? spectrum.slice().reverse() : spectrum.slice();
  const length = values.length;

  if (length === 0) {
    return { points, magnitudePercents };
  }

  for (let index = 0; index < length; index += 1) {
    let x;

    if (reflection === "1 side" || reflection === "combo") {
      x = index * ((width / 2) / Math.max(1, length - 1)) - width / 2;
    } else {
      x = index * (width / Math.max(1, length - 1)) - width / 2;
    }

    const targetIndex = index * 2;
    const magnitudePercent = clamp(
      (values[index] ?? 0) / Math.max(1, targetMax),
      0,
      1,
    );
    const currentX = x;
    const currentY = -((values[index] ?? 0) * waveScale + baseHeight);

    points[targetIndex] = currentX;
    points[targetIndex + 1] = currentY;
    magnitudePercents[index] = magnitudePercent;

    let mirrorIndex;

    switch (reflection) {
      case "1 side":
        if (index === length - 1) {
          break;
        }

        mirrorIndex = length * 4 - (index * 2 + 4);
        points[mirrorIndex] = -currentX;
        points[mirrorIndex + 1] = currentY;
        magnitudePercents[length * 2 - index - 2] = magnitudePercent;
        break;
      case "2 sides":
        mirrorIndex = length * 4 - (index * 2 + 2);
        points[mirrorIndex] = currentX;
        points[mirrorIndex + 1] = -currentY;
        magnitudePercents[length * 2 - index - 1] = magnitudePercent;
        break;
      case "combo":
        if (index !== length - 1) {
          mirrorIndex = length * 4 - (index * 2 + 4);
          points[mirrorIndex] = -currentX;
          points[mirrorIndex + 1] = currentY;

          mirrorIndex = length * 4 + (index * 2 - 2);
          points[mirrorIndex] = -currentX;
          points[mirrorIndex + 1] = -currentY;

          magnitudePercents[length * 2 - index - 2] = magnitudePercent;
          magnitudePercents[length * 2 + index - 1] = magnitudePercent;
        }

        mirrorIndex = length * 8 - (index * 2 + 6);
        points[mirrorIndex] = currentX;
        points[mirrorIndex + 1] = -currentY;
        magnitudePercents[length * 4 - index - 3] = magnitudePercent;
        break;
      default:
        break;
    }
  }

  if (waveStyle === "solid" && (reflection === "none" || reflection === "1 side")) {
    points.unshift(points[0] ?? -width / 2, 0);
    points.push(points[points.length - 2] ?? width / 2, 0);
    magnitudePercents.unshift(0);
    magnitudePercents.push(0);
  }

  return { points, magnitudePercents };
}

export function buildFlatWaveBars(
  spectrum: number[],
  width: number,
  baseHeight: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
  barWidth: number,
) {
  const pointSets: number[][] = [];
  const magnitudePercents: number[] = [];
  const reflection = normalizeFlatReflectionType(reflectionType);
  const values = inverted ? spectrum.slice().reverse() : spectrum.slice();
  const length = values.length;

  if (length === 0) {
    return { pointSets, magnitudePercents };
  }

  let calculatedBarWidth = (width / length) * barWidth;

  if (reflection === "1 side" || reflection === "combo") {
    calculatedBarWidth = (width / (length - 0.5)) * barWidth / 2;
  }

  for (let index = 0; index < length; index += 1) {
    let x;

    if (reflection === "1 side" || reflection === "combo") {
      const barContainerWidth = (width / 2) / Math.max(1, length - 0.5);
      const shift = (barContainerWidth - calculatedBarWidth) / 2;
      x = index * barContainerWidth - width / 2 + shift;
    } else {
      const shift = width / length - calculatedBarWidth;
      x = index * (width / length) - width / 2 + shift / 2;
    }

    const magnitude = values[index] ?? 0;
    const magnitudePercent = clamp(magnitude / Math.max(1, targetMax), 0, 1);
    const pointSet: [number, number, number, number] = [
      x,
      -(magnitude * waveScale + baseHeight),
      calculatedBarWidth,
      0,
    ];
    pointSets[index] = pointSet;
    magnitudePercents[index] = magnitudePercent;

    let mirrorIndex;

    switch (reflection) {
      case "1 side":
        pointSet[3] = -pointSet[1];
        mirrorIndex = length * 2 - index - 1;
        pointSets[mirrorIndex] = [
          -pointSet[0] - calculatedBarWidth,
          pointSet[1],
          pointSet[2],
          pointSet[3],
        ];
        magnitudePercents[mirrorIndex] = magnitudePercent;
        break;
      case "2 sides":
        pointSet[3] = -pointSet[1] * 2;
        break;
      case "combo":
        pointSet[3] = -pointSet[1] * 2;
        mirrorIndex = length * 2 - index - 1;
        pointSets[mirrorIndex] = [
          -pointSet[0] - calculatedBarWidth,
          pointSet[1],
          pointSet[2],
          pointSet[3],
        ];
        magnitudePercents[mirrorIndex] = magnitudePercent;
        break;
      default:
        pointSet[3] = -pointSet[1];
        break;
    }
  }

  return { pointSets, magnitudePercents };
}

function normalizeCircleReflectionType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "none";

  if (normalized.includes("four")) {
    return "four way";
  }

  if (normalized.includes("three")) {
    return "three way";
  }

  if (normalized.includes("slanted")) {
    return "slanted";
  }

  if (normalized.includes("vertical")) {
    return "vertical";
  }

  return "none";
}

function circleIndexToPoints(
  index: number,
  length: number,
  reflectionType: string,
  radius: number,
  magnitude: number,
) {
  const reflection = normalizeCircleReflectionType(reflectionType);
  const points: number[] = [];
  let angle = 0;

  switch (reflection) {
    case "vertical":
      angle = Math.PI * ((index + 0.5) / length) - Math.PI / 2;
      break;
    case "slanted":
      angle = Math.PI * (index / length) - Math.PI / 4;
      break;
    case "three way":
      angle = 0.66666666 * (Math.PI * (index / length) - Math.PI / 4);
      break;
    case "four way":
      angle = (Math.PI / 1.9999) * ((index + 0.5) / length) - Math.PI / 2;
      break;
    default:
      angle = 2 * (Math.PI * (index / length) - Math.PI / 4);
      break;
  }

  const dynamicRadius = radius + magnitude;
  points.push(-dynamicRadius * Math.cos(angle));
  points.push(dynamicRadius * Math.sin(angle));

  switch (reflection) {
    case "vertical":
      points.push(dynamicRadius * Math.cos(angle));
      points.push(dynamicRadius * Math.sin(angle));
      break;
    case "slanted":
      points.push(dynamicRadius * Math.cos(angle));
      points.push(-dynamicRadius * Math.sin(angle));
      break;
    case "three way": {
      let nextAngle =
        0.66666666 * (Math.PI * ((index + length) / length) - Math.PI / 4);
      points.push(-dynamicRadius * Math.cos(nextAngle));
      points.push(dynamicRadius * Math.sin(nextAngle));

      nextAngle =
        0.66666666 *
        (Math.PI * ((index + length * 2) / length) - Math.PI / 4);
      points.push(-dynamicRadius * Math.cos(nextAngle));
      points.push(dynamicRadius * Math.sin(nextAngle));
      break;
    }
    case "four way": {
      points.push(dynamicRadius * Math.cos(angle));
      points.push(dynamicRadius * Math.sin(angle));

      const mirroredAngle =
        (Math.PI / 1.9999) * ((length - 1 - index + 0.5) / length) -
        Math.PI / 2;
      points.push(dynamicRadius * Math.cos(mirroredAngle));
      points.push(-dynamicRadius * Math.sin(mirroredAngle));
      points.push(-dynamicRadius * Math.cos(mirroredAngle));
      points.push(-dynamicRadius * Math.sin(mirroredAngle));
      break;
    }
    default:
      break;
  }

  return points;
}

function concatCirclePoints(
  points: number[],
  pointSets: number[][],
  pointSetIndex: number,
  magnitudePercents: number[],
) {
  for (const pointSet of pointSets) {
    points.push(pointSet[pointSetIndex]!, pointSet[pointSetIndex + 1]!);
    magnitudePercents.push(pointSet[pointSet.length - 1]!);
  }
}

export function buildCircleWavePoints(
  spectrum: number[],
  radius: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
) {
  const points: number[] = [];
  const magnitudePercents: number[] = [];
  const values = inverted ? spectrum.slice().reverse() : spectrum.slice();
  const reflection = normalizeCircleReflectionType(reflectionType);
  const collectedPoints: number[][] = [];

  for (let index = 0; index < values.length; index += 1) {
    const pointCollection = circleIndexToPoints(
      index,
      values.length,
      reflection,
      radius,
      (values[index] ?? 0) * waveScale,
    );
    pointCollection.push(
      clamp((values[index] ?? 0) / Math.max(1, targetMax), 0, 1),
    );
    collectedPoints.push(pointCollection);
  }

  concatCirclePoints(points, collectedPoints, 0, magnitudePercents);

  switch (reflection) {
    case "vertical":
      concatCirclePoints(
        points,
        collectedPoints.slice().reverse(),
        2,
        magnitudePercents,
      );
      break;
    case "slanted":
      concatCirclePoints(points, collectedPoints, 2, magnitudePercents);
      break;
    case "three way":
      concatCirclePoints(points, collectedPoints, 2, magnitudePercents);
      concatCirclePoints(points, collectedPoints, 4, magnitudePercents);
      break;
    case "four way": {
      const reversed = collectedPoints.slice().reverse();
      concatCirclePoints(points, collectedPoints, 6, magnitudePercents);
      concatCirclePoints(points, reversed, 4, magnitudePercents);
      concatCirclePoints(points, reversed, 2, magnitudePercents);
      break;
    }
    default:
      break;
  }

  return { points, magnitudePercents };
}

export function buildCircleBarPointSets(
  spectrum: number[],
  radius: number,
  reflectionType: string,
  inverted: boolean,
  targetMax: number,
  waveScale: number,
  barWidth: number,
) {
  const pointSets: number[][] = [];
  const magnitudePercents: number[] = [];
  const values = inverted ? spectrum.slice().reverse() : spectrum.slice();
  const reflection = normalizeCircleReflectionType(reflectionType);

  for (let index = 0; index < values.length; index += 1) {
    const magnitude = (values[index] ?? 0) * waveScale;
    const pointSet1 = circleIndexToPoints(
      index - barWidth / 2,
      values.length,
      reflection,
      radius,
      magnitude,
    );
    const pointSet2 = circleIndexToPoints(
      index + barWidth / 2,
      values.length,
      reflection,
      radius,
      magnitude,
    );
    const magnitudePercent = clamp(
      (values[index] ?? 0) / Math.max(1, targetMax),
      0,
      1,
    );
    const points = [0, 0, pointSet1[0]!, pointSet1[1]!, pointSet2[0]!, pointSet2[1]!];
    pointSets.push(points);
    magnitudePercents.push(magnitudePercent);

    switch (reflection) {
      case "vertical":
      case "slanted": {
        pointSets.push([
          0,
          0,
          pointSet1[2]!,
          pointSet1[3]!,
          pointSet2[2]!,
          pointSet2[3]!,
        ]);
        magnitudePercents.push(magnitudePercent);
        break;
      }
      case "three way":
        pointSets.push(
          [0, 0, pointSet1[2]!, pointSet1[3]!, pointSet2[2]!, pointSet2[3]!],
          [0, 0, pointSet1[4]!, pointSet1[5]!, pointSet2[4]!, pointSet2[5]!],
        );
        magnitudePercents.push(magnitudePercent, magnitudePercent);
        break;
      case "four way":
        pointSets.push(
          [0, 0, pointSet1[2]!, pointSet1[3]!, pointSet2[2]!, pointSet2[3]!],
          [0, 0, pointSet1[4]!, pointSet1[5]!, pointSet2[4]!, pointSet2[5]!],
          [0, 0, pointSet1[6]!, pointSet1[7]!, pointSet2[6]!, pointSet2[7]!],
        );
        magnitudePercents.push(
          magnitudePercent,
          magnitudePercent,
          magnitudePercent,
        );
        break;
      default:
        break;
    }
  }

  return { pointSets, magnitudePercents };
}
