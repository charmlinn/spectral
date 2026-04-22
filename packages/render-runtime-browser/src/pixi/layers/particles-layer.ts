import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import { SidewaysParticlesRenderer } from "../particles/sideways";
import { StarTravelParticlesRenderer } from "../particles/star-travel";

type ParticleLayer = Extract<RenderLayer, { kind: "particles" }>;

type ParticleRenderer =
  | SidewaysParticlesRenderer
  | StarTravelParticlesRenderer;

function normalizeDirection(direction: string | null | undefined) {
  return (direction ?? "up").trim().toUpperCase();
}

function resolveParticleShape(items: string | null | undefined) {
  const normalized = items?.trim().toLowerCase() ?? "dots";

  if (normalized.includes("heart")) {
    return "heart";
  }

  if (normalized.includes("star")) {
    return "star";
  }

  return "circle";
}

function createParticleTextures(layer: ParticleLayer | null) {
  if (!layer) {
    return [];
  }

  return [
    {
      birthRate: layer.props.particles.birthRate,
      color: layer.props.particles.color,
      maxOpacity: layer.props.particles.maxOpacity,
      maxSize: layer.props.particles.maxSize,
      mediaData: null,
      minOpacity: layer.props.particles.minOpacity,
      minSize: layer.props.particles.minSize,
      shape: resolveParticleShape(layer.props.particles.items),
    },
  ];
}

export class PixiParticlesLayer {
  private renderer: ParticleRenderer = new SidewaysParticlesRenderer("up");
  private rendererDirection = "UP";

  get container() {
    return this.renderer.container;
  }

  private ensureRenderer(direction: string) {
    if (this.rendererDirection === direction) {
      return;
    }

    const currentContainer = this.renderer.container;
    const parent = currentContainer.parent;
    const index = parent ? parent.getChildIndex(currentContainer) : -1;

    this.renderer.destroy();
    this.renderer =
      direction === "OUT"
        ? new StarTravelParticlesRenderer()
        : new SidewaysParticlesRenderer(direction);
    this.rendererDirection = direction;

    if (parent && index >= 0) {
      parent.addChildAt(this.renderer.container, index);
    }
  }

  render(layer: ParticleLayer | null, input: BrowserRenderAdapterRenderInput) {
    this.container.visible = Boolean(layer);
    const direction = normalizeDirection(layer?.props.particles.direction);

    this.ensureRenderer(direction);
    this.renderer.updateSurface(input.surface);
    this.renderer.update(
      {
        enabled: Boolean(layer?.props.particles.enabled),
        particleTextures: createParticleTextures(layer),
        speedUpEnabled: Boolean(layer?.props.particles.speedUpEnabled),
      },
      input.frameContext.fps,
    );
    this.renderer.draw(layer?.props.amplitude ?? 0);
  }

  destroy() {
    this.renderer.destroy();
  }
}
