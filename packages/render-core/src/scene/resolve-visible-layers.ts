import type { RenderFrameContext, RenderLayer } from "../contracts/render";
import { isLayerVisible } from "../layers/visibility";

export function resolveVisibleLayers(
  layers: RenderLayer[],
  frameContext: RenderFrameContext,
): RenderLayer[] {
  return [...layers]
    .filter((layer) => isLayerVisible(layer, frameContext))
    .sort((left, right) => left.zIndex - right.zIndex);
}
