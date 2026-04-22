import type { LoadedMedia } from "../../adapters/canvas-media";
import type { RenderAssetResolver } from "@spectral/render-core";
import { ReactiveMedia } from "./reactive-media";

export class ReactiveImage extends ReactiveMedia {
  constructor(assetResolver: RenderAssetResolver | null | undefined) {
    super(assetResolver);
  }

  protected accepts(media: LoadedMedia) {
    return media.kind === "image";
  }
}

