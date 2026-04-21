import { createVisualizerBars, type RenderAssetResolver, type RenderLayer, type RenderSurface } from "@spectral/render-core";

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

function isCanvasElement(
  target: BrowserRenderAdapterMountTarget,
): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
}

async function loadImage(
  assetId: string,
  assetResolver: RenderAssetResolver,
  cache: MediaCache["images"],
): Promise<HTMLImageElement> {
  const cached = cache.get(assetId);
  if (cached) {
    return cached;
  }

  const promise = assetResolver.resolveImage(assetId).then(
    (url) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image asset ${assetId}.`));
        image.src = url;
      }),
  );

  cache.set(assetId, promise);
  return promise;
}

async function loadVideo(
  assetId: string,
  assetResolver: RenderAssetResolver,
  cache: MediaCache["videos"],
): Promise<HTMLVideoElement> {
  const cached = cache.get(assetId);
  if (cached) {
    return cached;
  }

  const promise = assetResolver.resolveVideo(assetId).then(
    (url) =>
      new Promise<HTMLVideoElement>((resolve, reject) => {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.onloadeddata = () => resolve(video);
        video.onerror = () => reject(new Error(`Failed to load video asset ${assetId}.`));
        video.src = url;
      }),
  );

  cache.set(assetId, promise);
  return promise;
}

function drawVisualizerLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "visualizer" }>,
  surface: RenderSurface,
): void {
  const bars = createVisualizerBars({
    spectrum: layer.props.spectrum,
    surface,
    maxBars: Math.max(16, Math.min(layer.props.config.barCount, layer.props.spectrum.length)),
  });

  context.fillStyle = "#22d3ee";

  for (const bar of bars) {
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
  }
}

function drawLyricsLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "lyrics" }>,
  surface: RenderSurface,
): void {
  if (!layer.props.activeSegment) {
    return;
  }

  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "600 42px Montserrat, sans-serif";
  context.fillText(
    layer.props.activeSegment.text,
    surface.width / 2,
    surface.height * 0.78,
    surface.width * 0.84,
  );
}

function drawTextLayer(
  context: CanvasRenderingContext2D,
  layer: Extract<RenderLayer, { kind: "text" }>,
  surface: RenderSurface,
): void {
  const textStyle = layer.props.layer.style;
  const fontWeight = textStyle.bold ? "700" : "400";
  const x = surface.width / 2 + textStyle.position.x;
  const y = surface.height / 2 + textStyle.position.y;

  context.fillStyle = textStyle.color;
  context.textAlign = textStyle.anchorPoint === "left" ? "left" : "center";
  context.textBaseline = "middle";
  context.font = `${fontWeight} ${textStyle.fontSize}px ${textStyle.font}, sans-serif`;

  if (textStyle.shadow.enabled) {
    context.shadowBlur = textStyle.shadow.blur;
    context.shadowColor = textStyle.shadow.color;
  } else {
    context.shadowBlur = 0;
    context.shadowColor = "transparent";
  }

  context.fillText(textStyle.text, x, y, surface.width * 0.92);
  context.shadowBlur = 0;
  context.shadowColor = "transparent";
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

  function assertContext(): CanvasRenderingContext2D {
    if (!context || !canvas) {
      throw new Error("Canvas 2D adapter has not been mounted.");
    }

    return context;
  }

  function syncCanvasSize(surface: RenderSurface): void {
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
      canvas = isCanvasElement(target) ? target : document.createElement("canvas");

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
      currentContext.fillStyle = input.sceneGraph.project.viewport.backgroundColor;
      currentContext.fillRect(0, 0, input.surface.width, input.surface.height);

      for (const layer of input.visibleLayers) {
        if (layer.kind === "backdrop" && layer.props.assetId) {
          if (!options.assetResolver) {
            throw new Error(
              `Backdrop asset ${layer.props.assetId} requires an asset resolver.`,
            );
          }

          if (layer.props.sourceKind === "image" || layer.props.sourceKind === "logo") {
            const image = await loadImage(layer.props.assetId, options.assetResolver, cache.images);
            currentContext.drawImage(image, 0, 0, input.surface.width, input.surface.height);
          } else if (layer.props.sourceKind === "video") {
            const video = await loadVideo(layer.props.assetId, options.assetResolver, cache.videos);
            if (Math.abs(video.currentTime - (input.frameContext.timeMs / 1000)) > 0.05) {
              video.currentTime = input.frameContext.timeMs / 1000;
            }
            currentContext.drawImage(video, 0, 0, input.surface.width, input.surface.height);
          } else if (layer.props.sourceKind !== null) {
            throw new Error(`Unsupported backdrop source kind ${layer.props.sourceKind}.`);
          }
        }

        if (layer.kind === "visualizer") {
          drawVisualizerLayer(currentContext, layer, input.surface);
        }

        if (layer.kind === "lyrics") {
          drawLyricsLayer(currentContext, layer, input.surface);
        }

        if (layer.kind === "text") {
          drawTextLayer(currentContext, layer, input.surface);
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
