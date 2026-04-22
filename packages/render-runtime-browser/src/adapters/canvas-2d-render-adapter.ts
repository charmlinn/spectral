import {
  computeDriftTransform,
  type RenderAssetResolver,
  type RenderLayer,
  type RenderSurface,
} from "@spectral/render-core";
import type { TextStyle } from "@spectral/project-schema";

import type {
  BrowserRenderAdapter,
  BrowserRenderAdapterMountTarget,
  BrowserRenderAdapterRenderInput,
} from "../contracts/runtime";
import {
  createParticleStore,
  drawParticlesLayer,
} from "./canvas-particles";
import {
  createMediaCache,
  drawMediaCover,
  resolveLoadedMedia,
  syncVideoFrame,
  type MediaCache,
} from "./canvas-media";
import {
  clamp,
  getBackdropMirrorAxes,
  getReflectionAngles,
  normalizeAmplitude,
  toColorString,
  toRadians,
} from "./canvas-utils";
import {
  createVisualizerBufferStore,
  drawVisualizerLayer,
} from "./visualizer/render";

type Canvas2dRenderAdapterOptions = {
  assetResolver?: RenderAssetResolver | null;
};

const DEFAULT_TEXT_COLOR = "#ffffff";

function isCanvasElement(
  target: BrowserRenderAdapterMountTarget,
): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
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

function applyTextShadow(
  context: CanvasRenderingContext2D,
  style: TextStyle,
  multiplier = 1,
) {
  if (style.shadow.enabled) {
    context.shadowColor = toColorString(
      style.shadow.color,
      clamp(style.shadow.opacity, 0, 1),
    );
    context.shadowBlur = style.shadow.blur * multiplier;
    return;
  }

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
}

function drawSpecterrTextLine(
  context: CanvasRenderingContext2D,
  input: BrowserRenderAdapterRenderInput,
  style: TextStyle,
  text: string,
  amplitude: number,
) {
  const multiplier = input.surface.height / 500;
  const drift = computeDriftTransform({
    drift: style.drift,
    kind: "text",
    timeMs: input.frameContext.timeMs,
    spectrumMagnitude: amplitude,
    width: input.surface.width * 0.8,
    height: input.surface.height * 0.2,
  });
  const textScale = 0.5;
  const fontSize = Math.max(1, style.fontSize * multiplier);

  context.save();
  context.translate(
    input.surface.width / 2 +
      style.position.x * multiplier +
      (drift?.translateX ?? 0),
    input.surface.height / 2 +
      style.position.y * multiplier +
      (drift?.translateY ?? 0),
  );
  context.rotate(drift?.rotationRad ?? 0);
  context.scale(
    (drift?.scale ?? 1) * textScale,
    (drift?.scale ?? 1) * textScale,
  );
  context.font = `${style.bold ? "700" : "400"} ${fontSize * 2}px ${style.font}, sans-serif`;
  context.fillStyle = toColorString(style.color ?? DEFAULT_TEXT_COLOR, 1);
  context.textAlign =
    style.anchorPoint === "left"
      ? "left"
      : style.anchorPoint === "right"
        ? "right"
        : "center";
  context.textBaseline = "middle";
  applyTextShadow(context, style, multiplier * 2);
  context.fillText(text, 0, 0, input.surface.width * 1.8);
  context.restore();
}

function drawTextLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "text" }>,
  input: BrowserRenderAdapterRenderInput,
) {
  drawSpecterrTextLine(
    context,
    input,
    layer.props.layer.style,
    layer.props.layer.style.text,
    layer.props.amplitude,
  );
}

function drawLyricsLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "lyrics" }>,
  input: BrowserRenderAdapterRenderInput,
) {
  if (!layer.props.activeSegment) {
    return;
  }

  drawSpecterrTextLine(
    context,
    input,
    layer.props.style,
    layer.props.activeSegment.text,
    layer.props.amplitude,
  );
}

export function createCanvas2dRenderAdapter(
  options: Canvas2dRenderAdapterOptions = {},
): BrowserRenderAdapter {
  const cache = createMediaCache();
  const particleStore = createParticleStore();
  const visualizerBuffers = createVisualizerBufferStore();
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
            visualizerBuffers,
            options.assetResolver,
          );
        }

        if (layer.kind === "particles") {
          drawParticlesLayer(currentContext, layer, input, particleStore);
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
