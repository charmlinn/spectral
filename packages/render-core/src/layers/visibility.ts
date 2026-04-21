import type { RenderFrameContext, RenderLayer } from "../contracts/render";

export function isLayerVisible(
  layer: RenderLayer,
  frameContext: RenderFrameContext,
): boolean {
  if (frameContext.timeMs < layer.startMs) {
    return false;
  }

  if (layer.endMs !== null && frameContext.timeMs > layer.endMs) {
    return false;
  }

  if (layer.kind === "lyrics") {
    return layer.props.activeSegment !== null;
  }

  if (layer.kind === "visualizer") {
    return layer.props.config.enabled;
  }

  if (layer.kind === "text") {
    return layer.props.layer.visible;
  }

  return true;
}
