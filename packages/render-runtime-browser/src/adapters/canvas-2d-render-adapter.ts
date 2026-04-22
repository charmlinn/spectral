import { processSpectrum } from "@spectral/audio-analysis";
import {
  computeDriftTransform,
  type RenderAssetResolver,
  type RenderLayer,
  type RenderSurface,
} from "@spectral/render-core";
import type {
  MediaReference,
  TextStyle,
  VisualizerWaveCircle,
} from "@spectral/project-schema";

import {
  createSpecterrWaveCircleOptions,
  type SpecterrWaveCircleRenderOptions,
} from "./specterr-visualizer-options";
import type {
  BrowserRenderAdapter,
  BrowserRenderAdapterMountTarget,
  BrowserRenderAdapterRenderInput,
} from "../contracts/runtime";

type Canvas2dRenderAdapterOptions = {
  assetResolver?: RenderAssetResolver | null;
};

type MediaCache = {
  images: Map<string, Promise<HTMLImageElement>>;
  videos: Map<string, Promise<HTMLVideoElement>>;
};

type LoadedMedia =
  | {
      kind: "image";
      element: HTMLImageElement;
    }
  | {
      kind: "video";
      element: HTMLVideoElement;
    };

const DEFAULT_TEXT_COLOR = "#ffffff";
const SPECTERR_HISTORY_LIMIT = 7;

function isCanvasElement(
  target: BrowserRenderAdapterMountTarget,
): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAmplitude(value: number) {
  return clamp(value / 255, 0, 1);
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toColorString(input: string | null | undefined, alpha = 1): string {
  if (!input) {
    return `rgba(255,255,255,${alpha})`;
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    if (normalized.length === 4) {
      const red = normalized[1]!;
      const green = normalized[2]!;
      const blue = normalized[3]!;

      return `rgba(${Number.parseInt(red + red, 16)}, ${Number.parseInt(green + green, 16)}, ${Number.parseInt(blue + blue, 16)}, ${alpha})`;
    }

    if (normalized.length === 7) {
      return `rgba(${Number.parseInt(normalized.slice(1, 3), 16)}, ${Number.parseInt(normalized.slice(3, 5), 16)}, ${Number.parseInt(normalized.slice(5, 7), 16)}, ${alpha})`;
    }
  }

  const hexValue = normalized.startsWith("0x")
    ? normalized.slice(2)
    : normalized;
  const parsed = Number.parseInt(hexValue, 16);

  if (Number.isFinite(parsed)) {
    return `rgba(${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}, ${alpha})`;
  }

  return input;
}

function toRgbTuple(input: string | null | undefined) {
  if (!input) {
    return { red: 255, green: 255, blue: 255 };
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    if (normalized.length === 4) {
      return {
        red: Number.parseInt(normalized[1]! + normalized[1]!, 16),
        green: Number.parseInt(normalized[2]! + normalized[2]!, 16),
        blue: Number.parseInt(normalized[3]! + normalized[3]!, 16),
      };
    }

    if (normalized.length === 7) {
      return {
        red: Number.parseInt(normalized.slice(1, 3), 16),
        green: Number.parseInt(normalized.slice(3, 5), 16),
        blue: Number.parseInt(normalized.slice(5, 7), 16),
      };
    }
  }

  const hexValue = normalized.startsWith("0x")
    ? normalized.slice(2)
    : normalized;
  const parsed = Number.parseInt(hexValue, 16);

  if (Number.isFinite(parsed)) {
    return {
      red: (parsed >> 16) & 255,
      green: (parsed >> 8) & 255,
      blue: parsed & 255,
    };
  }

  return { red: 255, green: 255, blue: 255 };
}

function mixColor(
  primary: string | null | undefined,
  secondary: string | null | undefined,
  mixPercent: number,
  alpha: number,
) {
  if (!secondary) {
    return toColorString(primary, alpha);
  }

  const from = toRgbTuple(primary);
  const to = toRgbTuple(secondary);
  const mix = clamp(mixPercent, 0, 1);

  return `rgba(${Math.round(from.red + (to.red - from.red) * mix)}, ${Math.round(from.green + (to.green - from.green) * mix)}, ${Math.round(from.blue + (to.blue - from.blue) * mix)}, ${alpha})`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeShakeOffset(
  timeMs: number,
  amplitude: number,
  strength: number,
) {
  const normalized = normalizeAmplitude(amplitude);

  return {
    x: Math.sin(timeMs / 80) * strength * normalized,
    y: Math.cos(timeMs / 65) * strength * normalized,
  };
}

function getCoverDimensions(
  mediaWidth: number,
  mediaHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (mediaWidth <= 0 || mediaHeight <= 0) {
    return {
      width: targetWidth,
      height: targetHeight,
    };
  }

  const scale = Math.max(targetWidth / mediaWidth, targetHeight / mediaHeight);

  return {
    width: mediaWidth * scale,
    height: mediaHeight * scale,
  };
}

function getMediaDimensions(media: LoadedMedia) {
  if (media.kind === "video") {
    return {
      width: media.element.videoWidth,
      height: media.element.videoHeight,
    };
  }

  return {
    width: media.element.naturalWidth,
    height: media.element.naturalHeight,
  };
}

function getReflectionAngles(type: string | null | undefined): number[] {
  const normalized = type?.toLowerCase() ?? "none";

  if (normalized.includes("four") || normalized.includes("combo")) {
    return [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  }

  if (normalized.includes("three")) {
    return [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  }

  if (normalized.includes("slanted")) {
    return [0, Math.PI / 4];
  }

  if (
    normalized.includes("vertical") ||
    normalized.includes("2 side") ||
    normalized.includes("1 side")
  ) {
    return [0, Math.PI];
  }

  return [0];
}

function getBackdropMirrorAxes(direction: string | null | undefined) {
  const normalized = direction?.toLowerCase() ?? "down";

  if (normalized.includes("left") || normalized.includes("right")) {
    return { x: -1, y: 1 };
  }

  return { x: 1, y: -1 };
}

function getRingRotation(
  timeMs: number,
  index: number,
  baseRotation: number,
  spinSettings: VisualizerWaveCircle["spinSettings"],
) {
  if (!spinSettings.enabled) {
    return baseRotation;
  }

  const turnsPerMs = spinSettings.speed / 60000;

  return (
    baseRotation +
    timeMs * turnsPerMs * Math.PI * 2 * (index % 2 === 0 ? 1 : -1)
  );
}

function getBassSpectrumSlice(spectrum: Float32Array) {
  return spectrum.slice(0, Math.max(12, Math.floor(spectrum.length * 0.18)));
}

function getSpectrumHistory(
  input: BrowserRenderAdapterRenderInput,
  waveType: string,
): number[][] {
  const historyProvider = (input.historyProvider ?? input.analysisProvider) as
    | ((typeof input.historyProvider | typeof input.analysisProvider) & {
        getHistoricalBassFrequencies?(includeNextFrame?: boolean): number[][];
        getHistoricalWideFrequencies?(includeNextFrame?: boolean): number[][];
      })
    | null
    | undefined;
  const fallbackProvider = input.analysisProvider ?? input.historyProvider;
  const normalizedWaveType = waveType.toLowerCase();

  if (normalizedWaveType.includes("bass")) {
    try {
      if (historyProvider?.getHistoricalBassFrequencies) {
        return historyProvider.getHistoricalBassFrequencies(true);
      }
    } catch {
      // Fall back to frame-based history when realtime history is unavailable.
    }

    const history: number[][] = [];

    for (
      let frameDelay = 0;
      frameDelay < SPECTERR_HISTORY_LIMIT;
      frameDelay += 1
    ) {
      const frame = Math.max(0, input.frameContext.frame - frameDelay);
      const spectrum = fallbackProvider?.getSpectrumAtFrame(frame);
      history.push(
        Array.from(getBassSpectrumSlice(spectrum ?? new Float32Array())),
      );
    }

    return history;
  }

  try {
    if (historyProvider?.getHistoricalWideFrequencies) {
      return historyProvider.getHistoricalWideFrequencies(true);
    }
  } catch {
    // Fall back to frame-based history when realtime history is unavailable.
  }

  const history: number[][] = [];

  for (
    let frameDelay = 0;
    frameDelay < SPECTERR_HISTORY_LIMIT;
    frameDelay += 1
  ) {
    const frame = Math.max(0, input.frameContext.frame - frameDelay);
    const spectrum = fallbackProvider?.getSpectrumAtFrame(frame);
    history.push(Array.from(spectrum ?? new Float32Array()));
  }

  return history;
}

function getSpectrumForVisualizer(
  layer: Extract<RenderLayer, { kind: "visualizer" }>,
  input: BrowserRenderAdapterRenderInput,
  ringOptions: SpecterrWaveCircleRenderOptions,
) {
  const spectrumHistory = getSpectrumHistory(
    input,
    layer.props.config.waveType,
  );
  const targetSpectrum =
    spectrumHistory[ringOptions.frameDelay] ??
    spectrumHistory[0] ??
    Array.from(
      layer.props.config.waveType.toLowerCase().includes("bass")
        ? layer.props.bassSpectrum
        : layer.props.spectrum,
    );

  return processSpectrum(targetSpectrum, ringOptions.spectrumOptions);
}

function getVisualizerRingStyle(
  layer: Extract<RenderLayer, { kind: "visualizer" }>,
  ringIndex: number,
): VisualizerWaveCircle {
  const ring = layer.props.config.waveCircles[ringIndex];

  if (ring) {
    return ring;
  }

  return {
    fillColor: "0xffffff",
    secondaryFillColor: "0xffffff",
    lineColor: "0xffffff",
    secondaryLineColor: "0xffffff",
    fillAlpha: 0.2,
    secondaryFillAlpha: 0.1,
    lineWidth: 2,
    lineAlpha: 1,
    secondaryLineAlpha: 0.6,
    visible: true,
    spinSettings: {
      enabled: false,
      speed: 0,
      acceleration: 0,
      logoLocked: false,
    },
    customOptions: {},
  };
}

type VisualizerRingRenderConfig = {
  barWidth: number;
  inverted: boolean;
  pointRadius: number;
  reflectionType: string;
  rotationRad: number;
  waveStyle: string;
};

function resolveVisualizerRingRenderConfig(
  config: Extract<RenderLayer, { kind: "visualizer" }>["props"]["config"],
  ring: VisualizerWaveCircle,
): VisualizerRingRenderConfig {
  const customOptions = ring.customOptions as Record<string, unknown>;
  const customEnabled = customOptions.enabled === true;

  return {
    barWidth:
      customEnabled && typeof customOptions.barWidth === "number"
        ? customOptions.barWidth
        : config.barWidth,
    inverted:
      customEnabled && typeof customOptions.inverted === "boolean"
        ? customOptions.inverted
        : config.inverted,
    pointRadius:
      customEnabled && typeof customOptions.pointRadius === "number"
        ? customOptions.pointRadius
        : config.pointRadius,
    reflectionType:
      customEnabled && typeof customOptions.reflectionType === "string"
        ? customOptions.reflectionType
        : config.reflectionType,
    rotationRad:
      customEnabled && typeof customOptions.rotation === "number"
        ? toRadians(customOptions.rotation)
        : 0,
    waveStyle:
      customEnabled && typeof customOptions.waveStyle === "string"
        ? customOptions.waveStyle
        : config.waveStyle,
  };
}

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

function buildFlatWavePoints(
  spectrum: number[],
  width: number,
  baseHeight: number,
  reflectionType: string,
  inverted: boolean,
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
    const magnitudePercent = clamp((values[index] ?? 0) / 255, 0, 1);
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

function buildFlatWaveBars(
  spectrum: number[],
  width: number,
  baseHeight: number,
  reflectionType: string,
  inverted: boolean,
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
    const magnitudePercent = clamp(magnitude / 255, 0, 1);
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

async function loadImageFromUrl(
  key: string,
  url: string,
  cache: MediaCache["images"],
): Promise<HTMLImageElement> {
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load image source ${key}.`));
    image.src = url;
  });

  cache.set(key, promise);

  return promise;
}

async function loadVideoFromUrl(
  key: string,
  url: string,
  cache: MediaCache["videos"],
): Promise<HTMLVideoElement> {
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => resolve(video);
    video.onerror = () =>
      reject(new Error(`Failed to load video source ${key}.`));
    video.src = url;
  });

  cache.set(key, promise);

  return promise;
}

async function resolveReferenceUrl(
  reference: MediaReference | null | undefined,
  assetResolver: RenderAssetResolver | null | undefined,
): Promise<string | null> {
  if (!reference) {
    return null;
  }

  if (reference.url) {
    return reference.url;
  }

  if (!reference.assetId || !assetResolver) {
    return null;
  }

  if (reference.kind === "video") {
    return assetResolver.resolveVideo(reference.assetId);
  }

  if (reference.kind === "audio") {
    return assetResolver.resolveAudio(reference.assetId);
  }

  return assetResolver.resolveImage(reference.assetId);
}

async function resolveLoadedMedia(
  reference: MediaReference | null | undefined,
  assetResolver: RenderAssetResolver | null | undefined,
  cache: MediaCache,
): Promise<LoadedMedia | null> {
  const url = await resolveReferenceUrl(reference, assetResolver);

  if (!url) {
    return null;
  }

  const key = reference?.assetId ?? url;

  if (reference?.kind === "video") {
    return {
      kind: "video",
      element: await loadVideoFromUrl(key, url, cache.videos),
    };
  }

  return {
    kind: "image",
    element: await loadImageFromUrl(key, url, cache.images),
  };
}

function syncVideoFrame(video: HTMLVideoElement, timeMs: number) {
  if (Math.abs(video.currentTime - timeMs / 1000) > 0.08) {
    video.currentTime = timeMs / 1000;
  }
}

function drawMediaCover(
  context: CanvasRenderingContext2D,
  media: LoadedMedia,
  width: number,
  height: number,
) {
  const dimensions = getMediaDimensions(media);
  const cover = getCoverDimensions(
    dimensions.width,
    dimensions.height,
    width,
    height,
  );

  context.drawImage(
    media.element,
    -cover.width / 2,
    -cover.height / 2,
    cover.width,
    cover.height,
  );
}

function drawBackdropVignette(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
) {
  if (strength <= 0) {
    return;
  }

  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.18,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.35})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);

  context.save();
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

async function drawBackdropLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "backdrop" }>,
  input: BrowserRenderAdapterRenderInput,
  cache: MediaCache,
  assetResolver: RenderAssetResolver | null | undefined,
) {
  if (!layer.props.source) {
    return;
  }

  const media = await resolveLoadedMedia(
    layer.props.source,
    assetResolver,
    cache,
  );

  if (!media) {
    return;
  }

  if (media.kind === "video") {
    syncVideoFrame(media.element, input.frameContext.timeMs);
  }

  const drift = computeDriftTransform({
    drift: layer.props.drift,
    kind: "backdrop",
    timeMs: input.frameContext.timeMs,
    spectrumMagnitude: layer.props.bassAmplitude,
    width: input.surface.width,
    height: input.surface.height,
  });
  const normalizedBassAmplitude = normalizeAmplitude(layer.props.bassAmplitude);
  const paddingScale = Math.max(1, layer.props.paddingFactor);
  const bounceScale = layer.props.bounceEnabled
    ? 1 + normalizedBassAmplitude * Math.max(0, layer.props.bounceScale)
    : 1;
  const shake =
    !drift && layer.props.shakeEnabled
      ? computeShakeOffset(
          input.frameContext.timeMs,
          layer.props.bassAmplitude,
          Math.max(0, layer.props.shakeFactor),
        )
      : { x: 0, y: 0 };
  const contrast = layer.props.contrastEnabled
    ? Math.min(
        Math.max(1, layer.props.maxContrast),
        1 + normalizedBassAmplitude * Math.max(0, layer.props.contrastFactor),
      )
    : 1;
  const zoomBlurStrength = layer.props.zoomBlurEnabled
    ? Math.min(
        Math.max(0, layer.props.maxZoomBlur),
        normalizedBassAmplitude * Math.max(0, layer.props.zoomBlurFactor),
      )
    : 0;
  const hue =
    layer.props.filterEnabled || layer.props.hlsAdjustment.enabled
      ? layer.props.hlsAdjustment.hue
      : 0;
  const saturation =
    layer.props.filterEnabled || layer.props.hlsAdjustment.enabled
      ? layer.props.hlsAdjustment.saturation
      : 0;
  const lightness =
    layer.props.filterEnabled || layer.props.hlsAdjustment.enabled
      ? layer.props.hlsAdjustment.lightness
      : 0;
  const baseRotation = toRadians(layer.props.rotation);
  const mediaScale = (drift?.scale ?? 1) * paddingScale * bounceScale;
  const reflectionAngles =
    layer.props.reflection.type === "none"
      ? [0]
      : [0, ...getReflectionAngles(layer.props.reflection.type).slice(1)];
  const filterParts = [
    `hue-rotate(${hue}deg)`,
    `saturate(${100 + saturation}%)`,
    `brightness(${100 + lightness}%)`,
    `contrast(${contrast * 100}%)`,
  ];

  for (const [index, reflectionAngle] of reflectionAngles.entries()) {
    context.save();
    context.translate(
      input.surface.width / 2 + (drift?.translateX ?? 0) + shake.x,
      input.surface.height / 2 + (drift?.translateY ?? 0) + shake.y,
    );
    context.rotate(baseRotation + (drift?.rotationRad ?? 0) + reflectionAngle);

    if (index > 0) {
      const mirror = getBackdropMirrorAxes(layer.props.reflection.direction);
      context.scale(mirror.x, mirror.y);
    }

    if (zoomBlurStrength > 0) {
      const blurSteps = 4;

      for (let step = 1; step <= blurSteps; step += 1) {
        const blurMix = step / blurSteps;
        context.save();
        context.filter = `${filterParts.join(" ")} blur(${(zoomBlurStrength * 22 * blurMix).toFixed(2)}px)`;
        context.globalAlpha = (index === 0 ? 0.12 : 0.06) * blurMix;
        context.scale(
          mediaScale * (1 + zoomBlurStrength * 0.09 * step),
          mediaScale * (1 + zoomBlurStrength * 0.09 * step),
        );
        drawMediaCover(context, media, input.surface.width, input.surface.height);
        context.restore();
      }
    }

    context.filter = filterParts.join(" ");
    context.globalAlpha = index === 0 ? 1 : 0.4;
    context.scale(mediaScale, mediaScale);
    drawMediaCover(context, media, input.surface.width, input.surface.height);
    context.restore();
  }

  if (
    layer.props.hlsAdjustment.enabled &&
    layer.props.hlsAdjustment.colorize &&
    layer.props.hlsAdjustment.alpha > 0
  ) {
    context.save();
    context.globalCompositeOperation = "overlay";
    context.fillStyle = `hsla(${hue}, 85%, 55%, ${clamp(layer.props.hlsAdjustment.alpha, 0, 1)})`;
    context.fillRect(0, 0, input.surface.width, input.surface.height);
    context.restore();
  }

  if (layer.props.vignetteEnabled) {
    const vignetteStrength = Math.min(
      Math.max(0, layer.props.maxVignette),
      normalizedBassAmplitude * Math.max(0, layer.props.vignetteFactor),
    );

    drawBackdropVignette(
      context,
      input.surface.width,
      input.surface.height,
      vignetteStrength,
    );
  }
}

function drawCircleWave(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  radius: number,
  waveScale: number,
  centerCutoutFactor: number,
  ring: VisualizerWaveCircle,
  showFill: boolean,
) {
  const points = spectrum.length;

  if (points === 0) {
    return;
  }

  const scaledWaveRadius = waveScale * radius * 0.28;
  const centerCutout = clamp(centerCutoutFactor / 100, 0, 0.95);
  const magnitudePercents: number[] = [];

  context.beginPath();

  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const value = clamp(spectrum[index] ?? 0, 0, 255) / 255;
    magnitudePercents.push(value);
    const dynamicRadius =
      radius * (1 - centerCutout) + value * scaledWaveRadius;
    const x = Math.cos(angle) * dynamicRadius;
    const y = Math.sin(angle) * dynamicRadius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  const mixPercent = clamp(average(magnitudePercents) * 5, 0, 1);
  context.fillStyle = mixColor(
    ring.fillColor,
    ring.secondaryFillColor,
    mixPercent,
    clamp(
      ring.fillAlpha * (1 - mixPercent) + ring.secondaryFillAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.strokeStyle = mixColor(
    ring.lineColor,
    ring.secondaryLineColor,
    mixPercent,
    clamp(
      ring.lineAlpha * (1 - mixPercent) + ring.secondaryLineAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.lineWidth = Math.max(1, ring.lineWidth);

  if (showFill || ring.fillAlpha > 0 || ring.secondaryFillAlpha > 0) {
    context.fill();
  }

  context.stroke();
}

function drawBarCircle(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  radius: number,
  waveScale: number,
  barWidth: number,
  ring: VisualizerWaveCircle,
) {
  const bars = spectrum.length;
  const barLength = radius * 0.55 * Math.max(0.4, waveScale);
  context.lineWidth = Math.max(1, barWidth * 2);

  for (let index = 0; index < bars; index += 1) {
    const angle = (index / bars) * Math.PI * 2;
    const value = clamp(spectrum[index] ?? 0, 0, 255) / 255;
    context.strokeStyle = mixColor(
      ring.lineColor,
      ring.secondaryLineColor,
      value,
      clamp(
        ring.lineAlpha * (1 - value) + ring.secondaryLineAlpha * value,
        0,
        1,
      ),
    );
    const innerRadius = radius;
    const outerRadius = radius + value * barLength;
    context.beginPath();
    context.moveTo(
      Math.cos(angle) * innerRadius,
      Math.sin(angle) * innerRadius,
    );
    context.lineTo(
      Math.cos(angle) * outerRadius,
      Math.sin(angle) * outerRadius,
    );
    context.stroke();
  }
}

function drawPointCircle(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  radius: number,
  waveScale: number,
  pointRadius: number,
  ring: VisualizerWaveCircle,
) {
  const points = spectrum.length;
  const computedPointRadius = Math.max(1, pointRadius * 1.5);

  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const value = clamp(spectrum[index] ?? 0, 0, 255) / 255;
    context.fillStyle = mixColor(
      ring.fillColor,
      ring.secondaryFillColor,
      value,
      clamp(
        ring.fillAlpha * (1 - value) + ring.secondaryFillAlpha * value,
        0,
        1,
      ),
    );
    context.strokeStyle = mixColor(
      ring.lineColor,
      ring.secondaryLineColor,
      value,
      clamp(
        ring.lineAlpha * (1 - value) + ring.secondaryLineAlpha * value,
        0,
        1,
      ),
    );
    context.lineWidth = Math.max(1, ring.lineWidth);
    const distance = radius + value * radius * 0.4 * waveScale;
    context.beginPath();
    context.arc(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      computedPointRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  }
}

function drawFlatWave(
  context: CanvasRenderingContext2D,
  spectrum: number[],
  width: number,
  baseHeight: number,
  reflectionType: string,
  inverted: boolean,
  waveStyle: string,
  waveScale: number,
  barWidth: number,
  pointRadius: number,
  ring: VisualizerWaveCircle,
) {
  if (waveStyle === "bar") {
    const { pointSets, magnitudePercents } = buildFlatWaveBars(
      spectrum,
      width,
      baseHeight,
      reflectionType,
      inverted,
      waveScale,
      barWidth,
    );

    for (let index = 0; index < pointSets.length; index += 1) {
      const pointSet = pointSets[index];

      if (!pointSet) {
        continue;
      }

      const mixPercent = magnitudePercents[index] ?? 0;
      context.fillStyle = mixColor(
        ring.fillColor,
        ring.secondaryFillColor,
        mixPercent,
        clamp(
          ring.fillAlpha * (1 - mixPercent) +
            ring.secondaryFillAlpha * mixPercent,
          0,
          1,
        ),
      );
      context.strokeStyle = mixColor(
        ring.lineColor,
        ring.secondaryLineColor,
        mixPercent,
        clamp(
          ring.lineAlpha * (1 - mixPercent) + ring.secondaryLineAlpha * mixPercent,
          0,
          1,
        ),
      );
      context.lineWidth = Math.max(1, ring.lineWidth);
      context.beginPath();
      context.rect(pointSet[0]!, pointSet[1]!, pointSet[2]!, pointSet[3]!);
      context.fill();
      context.stroke();
    }

    return;
  }

  const { points, magnitudePercents } = buildFlatWavePoints(
    spectrum,
    width,
    baseHeight,
    reflectionType,
    inverted,
    waveScale,
    waveStyle,
  );

  if (points.length < 4) {
    return;
  }

  const mixPercent = clamp(average(magnitudePercents) * 5, 0, 1);
  context.beginPath();

  for (let index = 0; index < points.length; index += 2) {
    const x = points[index]!;
    const y = points[index + 1]!;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.fillStyle = mixColor(
    ring.fillColor,
    ring.secondaryFillColor,
    mixPercent,
    clamp(
      ring.fillAlpha * (1 - mixPercent) + ring.secondaryFillAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.strokeStyle = mixColor(
    ring.lineColor,
    ring.secondaryLineColor,
    mixPercent,
    clamp(
      ring.lineAlpha * (1 - mixPercent) + ring.secondaryLineAlpha * mixPercent,
      0,
      1,
    ),
  );
  context.lineWidth = Math.max(1, barWidth * 2);
  if (waveStyle === "solid") {
    context.fill();
  }
  context.stroke();

  if (waveStyle === "point") {
    for (let index = 0; index < points.length - 1; index += 2) {
      const value = magnitudePercents[Math.floor(index / 2)] ?? 0;
      const x = points[index]!;
      const y = points[index + 1]!;
      context.fillStyle = mixColor(
        ring.fillColor,
        ring.secondaryFillColor,
        value,
        clamp(
          ring.fillAlpha * (1 - value) + ring.secondaryFillAlpha * value,
          0,
          1,
        ),
      );
      context.strokeStyle = mixColor(
        ring.lineColor,
        ring.secondaryLineColor,
        value,
        clamp(
          ring.lineAlpha * (1 - value) + ring.secondaryLineAlpha * value,
          0,
          1,
        ),
      );
      context.lineWidth = Math.max(1, ring.lineWidth);
      context.beginPath();
      context.arc(x, y, Math.max(1, pointRadius), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }
}

async function drawVisualizerMedia(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "visualizer" }>,
  radius: number,
  timeMs: number,
  cache: MediaCache,
  assetResolver: RenderAssetResolver | null | undefined,
) {
  const source =
    layer.props.config.logoSource ?? layer.props.config.mediaSource;

  if (!source || !layer.props.config.logoVisible) {
    return;
  }

  const media = await resolveLoadedMedia(source, assetResolver, cache);

  if (!media) {
    return;
  }

  if (media.kind === "video") {
    syncVideoFrame(media.element, timeMs);
  }

  const logoRadius = radius * Math.max(0.2, layer.props.config.logoSizeFactor);
  const scale =
    1 +
    normalizeAmplitude(layer.props.bassAmplitude) *
      0.18 *
      layer.props.config.bounceFactor;

  context.save();
  context.beginPath();
  context.arc(0, 0, Math.max(24, logoRadius), 0, Math.PI * 2);
  context.clip();
  context.scale(scale, scale);
  drawMediaCover(context, media, logoRadius * 2, logoRadius * 2);
  context.restore();
}

async function drawVisualizerLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "visualizer" }>,
  input: BrowserRenderAdapterRenderInput,
  cache: MediaCache,
  assetResolver: RenderAssetResolver | null | undefined,
) {
  const config = layer.props.config;
  const ringCount = Math.max(1, config.waveCircles.length || 1);
  const normalizedAmplitude = normalizeAmplitude(layer.props.bassAmplitude);
  const drift = computeDriftTransform({
    drift: config.drift,
    kind: "visualizer",
    timeMs: input.frameContext.timeMs,
    spectrumMagnitude: layer.props.bassAmplitude,
    width: input.surface.width * 0.5,
    height: input.surface.height * 0.5,
  });
  const shakeStrength =
    config.shakeAmount === "lot"
      ? 20
      : config.shakeAmount === "little"
        ? 10
        : 0;
  const shake =
    !drift && shakeStrength > 0
      ? computeShakeOffset(
          input.frameContext.timeMs,
          layer.props.bassAmplitude,
          shakeStrength,
        )
      : { x: 0, y: 0 };
  const baseRadius =
    Math.min(input.surface.width, input.surface.height) *
    (0.16 + clamp(config.radiusFactor / 1000, 0, 0.25));
  const baseRotation = toRadians(config.rotation);
  const bounceScale = 1 + normalizedAmplitude * 0.14 * config.bounceFactor;
  const waveCircleOptions = createSpecterrWaveCircleOptions({
    barCount: config.barCount,
    customSettings: config.waveCircles.map(
      (waveCircle) => waveCircle.customOptions,
    ),
    delayed: config.delayed,
    layoutType: config.layoutType,
    reflectionType: config.reflectionType,
    ringCount,
    separation: config.seperationFactor,
    shape: config.shape,
    smoothed: config.smoothed,
    waveScale: config.waveScaleFactor,
    waveStyle: config.waveStyle,
    waveType: config.waveType,
  });

  context.save();
  context.translate(
    input.surface.width / 2 +
      config.position.x +
      (drift?.translateX ?? 0) +
      shake.x,
    input.surface.height / 2 +
      config.position.y +
      (drift?.translateY ?? 0) +
      shake.y,
  );
  context.rotate(baseRotation + (drift?.rotationRad ?? 0));
  context.scale(
    (drift?.scale ?? 1) * bounceScale,
    (drift?.scale ?? 1) * bounceScale,
  );

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const ring = getVisualizerRingStyle(layer, ringIndex);

    if (!ring.visible) {
      continue;
    }

    const renderConfig = resolveVisualizerRingRenderConfig(config, ring);

    const waveCircleOption =
      waveCircleOptions[ringIndex] ?? waveCircleOptions[0]!;
    const radius = baseRadius * waveCircleOption.scale;
    const processedSpectrum = getSpectrumForVisualizer(
      layer,
      input,
      waveCircleOption,
    );
    const ringRotation = getRingRotation(
      input.frameContext.timeMs,
      ringIndex,
      0,
      ring.spinSettings,
    );

    const activeReflectionAngles =
      config.shape === "flat"
        ? [0]
        : getReflectionAngles(renderConfig.reflectionType);

    for (const reflectionAngle of activeReflectionAngles) {
      context.save();
      context.rotate(
        reflectionAngle +
          renderConfig.rotationRad +
          (config.shape === "flat" ? 0 : ringRotation),
      );
      context.shadowColor = toColorString(
        ring.lineColor,
        config.glowSettings.enabled || config.dropShadowSettings.enabled
          ? clamp(config.dropShadowSettings.opacity, 0.1, 0.8)
          : 0,
      );
      context.shadowBlur = config.glowSettings.enabled
        ? Math.max(0, config.glowSettings.blur) * 1.2
        : config.dropShadowSettings.enabled
          ? config.dropShadowSettings.blur
          : 0;

      if (config.shape === "flat") {
        drawFlatWave(
          context,
          processedSpectrum,
          Math.min(
            input.surface.width * 0.78,
            Math.max(180, config.width || input.surface.width * 0.78),
          ),
          Math.max(
            80,
            (config.baseHeight || input.surface.height * 0.14) +
              waveCircleOption.heightAdjust,
          ),
          renderConfig.reflectionType,
          renderConfig.inverted,
          renderConfig.waveStyle,
          waveCircleOption.waveScale,
          renderConfig.barWidth,
          renderConfig.pointRadius,
          ring,
        );
      } else if (renderConfig.waveStyle === "bar") {
        drawBarCircle(
          context,
          processedSpectrum,
          radius,
          waveCircleOption.waveScale,
          renderConfig.barWidth,
          ring,
        );
      } else if (renderConfig.waveStyle === "point") {
        drawPointCircle(
          context,
          processedSpectrum,
          radius,
          waveCircleOption.waveScale,
          renderConfig.pointRadius,
          ring,
        );
      } else {
        drawCircleWave(
          context,
          processedSpectrum,
          radius,
          waveCircleOption.waveScale,
          config.centerCutoutFactor,
          ring,
          config.waveStyle === "solid",
        );
      }

      context.restore();
    }
  }

  await drawVisualizerMedia(
    context,
    layer,
    baseRadius * Math.max(0.8, config.logoSizeFactor),
    input.frameContext.timeMs,
    cache,
    assetResolver,
  );
  context.restore();
}

function applyTextShadow(context: CanvasRenderingContext2D, style: TextStyle) {
  if (style.shadow.enabled) {
    context.shadowColor = toColorString(
      style.shadow.color,
      clamp(style.shadow.opacity, 0, 1),
    );
    context.shadowBlur = style.shadow.blur;
    return;
  }

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
}

function drawTextLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "text" }>,
  input: BrowserRenderAdapterRenderInput,
) {
  const style = layer.props.layer.style;
  const drift = computeDriftTransform({
    drift: style.drift,
    kind: "text",
    timeMs: input.frameContext.timeMs,
    spectrumMagnitude: layer.props.amplitude,
    width: input.surface.width * 0.8,
    height: input.surface.height * 0.2,
  });

  context.save();
  context.translate(
    input.surface.width / 2 + style.position.x + (drift?.translateX ?? 0),
    input.surface.height / 2 + style.position.y + (drift?.translateY ?? 0),
  );
  context.rotate(drift?.rotationRad ?? 0);
  context.scale(drift?.scale ?? 1, drift?.scale ?? 1);
  context.font = `${style.bold ? "700" : "400"} ${style.fontSize}px ${style.font}, sans-serif`;
  context.fillStyle = toColorString(style.color ?? DEFAULT_TEXT_COLOR, 1);
  context.textAlign =
    style.anchorPoint === "left"
      ? "left"
      : style.anchorPoint === "right"
        ? "right"
        : "center";
  context.textBaseline = "middle";
  applyTextShadow(context, style);
  context.fillText(style.text, 0, 0, input.surface.width * 0.9);
  context.restore();
}

function drawLyricsLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "lyrics" }>,
  input: BrowserRenderAdapterRenderInput,
) {
  if (!layer.props.activeSegment) {
    return;
  }

  const style = layer.props.style;
  const drift = computeDriftTransform({
    drift: style.drift,
    kind: "text",
    timeMs: input.frameContext.timeMs,
    spectrumMagnitude: layer.props.amplitude,
    width: input.surface.width * 0.8,
    height: input.surface.height * 0.2,
  });

  context.save();
  context.translate(
    input.surface.width / 2 + style.position.x + (drift?.translateX ?? 0),
    input.surface.height * 0.78 + style.position.y + (drift?.translateY ?? 0),
  );
  context.rotate(drift?.rotationRad ?? 0);
  context.scale(drift?.scale ?? 1, drift?.scale ?? 1);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = toColorString(style.color ?? DEFAULT_TEXT_COLOR, 1);
  context.font = `${style.bold ? "700" : "500"} ${style.fontSize}px ${style.font}, sans-serif`;
  applyTextShadow(context, style);
  context.fillText(
    layer.props.activeSegment.text,
    0,
    0,
    input.surface.width * 0.84,
  );

  context.fillStyle = toColorString(style.color ?? DEFAULT_TEXT_COLOR, 0.35);
  context.font = `${style.bold ? "600" : "400"} ${Math.max(18, style.fontSize * 0.62)}px ${style.font}, sans-serif`;

  if (layer.props.previousSegment) {
    context.fillText(
      layer.props.previousSegment.text,
      0,
      -style.fontSize * 1.15,
      input.surface.width * 0.78,
    );
  }

  if (layer.props.nextSegment) {
    context.fillText(
      layer.props.nextSegment.text,
      0,
      style.fontSize * 1.1,
      input.surface.width * 0.78,
    );
  }

  context.restore();
}

function drawParticleShape(
  context: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  size: number,
) {
  if (kind.toLowerCase().includes("star")) {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.45;

    context.beginPath();

    for (let index = 0; index < spikes * 2; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = (index * Math.PI) / spikes;
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;

      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }

    context.closePath();
    context.fill();
    return;
  }

  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
}

function drawParticlesLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "particles" }>,
  input: BrowserRenderAdapterRenderInput,
) {
  const config = layer.props.particles;
  const amplitude = normalizeAmplitude(layer.props.amplitude);
  const count = clamp(Math.round(config.birthRate * 1.6), 12, 120);
  const speedMultiplier = config.speedUpEnabled ? 1 + amplitude * 2.5 : 1;
  const baseSize = Math.min(input.surface.width, input.surface.height) * 0.04;

  context.save();
  context.fillStyle = toColorString(
    config.color,
    clamp(config.maxOpacity, 0.05, 1),
  );

  for (let index = 0; index < count; index += 1) {
    const seed = index * 917.37;
    const progress =
      ((input.frameContext.timeMs / 1000) * (0.08 + speedMultiplier * 0.12) +
        seed) %
      1;
    const alt = ((seed * 1.73) % 1) - 0.5;
    const size =
      baseSize *
      clamp(
        (config.minSize +
          (config.maxSize - config.minSize) * ((seed * 0.37) % 1 || 0.5)) *
          0.5,
        0.08,
        2,
      );
    const opacity = clamp(
      config.minOpacity +
        (config.maxOpacity - config.minOpacity) * ((seed * 0.53) % 1 || 0.5),
      0.05,
      1,
    );

    let x = input.surface.width / 2;
    let y = input.surface.height / 2;

    if (config.direction.toLowerCase() === "out") {
      const angle = ((seed * 7) % 1) * Math.PI * 2;
      const distance =
        progress * Math.max(input.surface.width, input.surface.height) * 0.65;
      x += Math.cos(angle) * distance;
      y += Math.sin(angle) * distance;
    } else if (config.direction.toLowerCase() === "left") {
      x = input.surface.width * (1 - progress);
      y = input.surface.height * (0.1 + (alt + 0.5) * 0.8);
    } else if (config.direction.toLowerCase() === "right") {
      x = input.surface.width * progress;
      y = input.surface.height * (0.1 + (alt + 0.5) * 0.8);
    } else if (config.direction.toLowerCase() === "down") {
      x = input.surface.width * (0.1 + (alt + 0.5) * 0.8);
      y = input.surface.height * progress;
    } else {
      x = input.surface.width * (0.1 + (alt + 0.5) * 0.8);
      y = input.surface.height * (1 - progress);
    }

    context.globalAlpha = opacity;
    drawParticleShape(context, config.items, x, y, size);
  }

  context.restore();
}

export function createCanvas2dRenderAdapter(
  options: Canvas2dRenderAdapterOptions = {},
): BrowserRenderAdapter {
  const cache: MediaCache = {
    images: new Map(),
    videos: new Map(),
  };
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let mountedTarget: BrowserRenderAdapterMountTarget | null = null;

  function assertContext() {
    if (!canvas || !context) {
      throw new Error("Canvas 2D adapter has not been mounted.");
    }

    return context;
  }

  function syncCanvasSize(surface: RenderSurface) {
    if (!canvas) {
      return;
    }

    canvas.width = Math.round(surface.width * surface.dpr);
    canvas.height = Math.round(surface.height * surface.dpr);
    canvas.style.width = `${surface.width}px`;
    canvas.style.height = `${surface.height}px`;
  }

  return {
    mount(target, surface) {
      mountedTarget = target;
      canvas = isCanvasElement(target)
        ? target
        : document.createElement("canvas");

      if (!isCanvasElement(target)) {
        target.replaceChildren(canvas);
      }

      context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Failed to acquire 2D canvas context.");
      }

      syncCanvasSize(surface);
    },
    resize(surface) {
      syncCanvasSize(surface);
    },
    async render(input) {
      const currentContext = assertContext();
      currentContext.setTransform(1, 0, 0, 1, 0, 0);
      currentContext.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      currentContext.scale(input.surface.dpr, input.surface.dpr);
      currentContext.fillStyle =
        input.sceneGraph.project.viewport.backgroundColor;
      currentContext.fillRect(0, 0, input.surface.width, input.surface.height);

      for (const layer of input.visibleLayers) {
        if (layer.kind === "backdrop") {
          await drawBackdropLayer(
            currentContext,
            layer,
            input,
            cache,
            options.assetResolver,
          );
        }

        if (layer.kind === "visualizer") {
          await drawVisualizerLayer(
            currentContext,
            layer,
            input,
            cache,
            options.assetResolver,
          );
        }

        if (layer.kind === "particles") {
          drawParticlesLayer(currentContext, layer, input);
        }

        if (layer.kind === "lyrics") {
          drawLyricsLayer(currentContext, layer, input);
        }

        if (layer.kind === "text") {
          drawTextLayer(currentContext, layer, input);
        }
      }
    },
    destroy() {
      if (mountedTarget && canvas && !isCanvasElement(mountedTarget)) {
        mountedTarget.replaceChildren();
      }

      canvas = null;
      context = null;
      mountedTarget = null;
      cache.images.clear();
      cache.videos.clear();
    },
  };
}
