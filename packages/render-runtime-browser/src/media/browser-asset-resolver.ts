import type { RenderAssetResolver } from "@spectral/render-core";

export function createCachedBrowserAssetResolver(
  resolver: RenderAssetResolver,
): RenderAssetResolver {
  const imageCache = new Map<string, Promise<string>>();
  const videoCache = new Map<string, Promise<string>>();
  const audioCache = new Map<string, Promise<string>>();
  const fontCache = new Map<string, Promise<string | null>>();

  return {
    resolveImage(assetId) {
      const cached = imageCache.get(assetId);
      if (cached) {
        return cached;
      }

      const promise = resolver.resolveImage(assetId);
      imageCache.set(assetId, promise);
      return promise;
    },
    resolveVideo(assetId) {
      const cached = videoCache.get(assetId);
      if (cached) {
        return cached;
      }

      const promise = resolver.resolveVideo(assetId);
      videoCache.set(assetId, promise);
      return promise;
    },
    resolveAudio(assetId) {
      const cached = audioCache.get(assetId);
      if (cached) {
        return cached;
      }

      const promise = resolver.resolveAudio(assetId);
      audioCache.set(assetId, promise);
      return promise;
    },
    resolveFont(fontId) {
      const cached = fontCache.get(fontId);
      if (cached) {
        return cached;
      }

      const promise = resolver.resolveFont(fontId);
      fontCache.set(fontId, promise);
      return promise;
    },
  };
}
