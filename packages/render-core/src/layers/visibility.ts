import type { RenderFrameContext, RenderLayer } from "../contracts/render";

function hasRenderableParticles(
  particles: Extract<RenderLayer, { kind: "particles" }>["props"]["particles"],
) {
  if (particles.enabled) {
    return true;
  }

  if (Array.isArray(particles.items)) {
    return particles.items.some((item) => (item.birthRate ?? 0) > 0);
  }

  return (particles.birthRate ?? 0) > 0;
}

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

  if (layer.kind === "particles") {
    return hasRenderableParticles(layer.props.particles);
  }

  return true;
}
