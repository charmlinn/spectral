import type { RenderAssetResolver } from "@spectral/render-core";
import type { MediaReference } from "@spectral/project-schema";

export type MediaCache = {
  images: Map<string, Promise<HTMLImageElement>>;
  videos: Map<string, Promise<HTMLVideoElement>>;
};

export type LoadedMedia =
  | {
      kind: "image";
      element: HTMLImageElement;
    }
  | {
      kind: "video";
      element: HTMLVideoElement;
    };

export function createMediaCache(): MediaCache {
  return {
    images: new Map(),
    videos: new Map(),
  };
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

export async function resolveLoadedMedia(
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

export function syncVideoFrame(video: HTMLVideoElement, timeMs: number) {
  if (Math.abs(video.currentTime - timeMs / 1000) > 0.08) {
    video.currentTime = timeMs / 1000;
  }
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

export function drawMediaCover(
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
