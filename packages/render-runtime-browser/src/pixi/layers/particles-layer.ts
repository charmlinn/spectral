import type { RenderLayer } from "@spectral/render-core";
import type { ProcessSpectrumOptions } from "@spectral/audio-analysis";

import type { BrowserRenderAdapterRenderInput } from "../../contracts/runtime";
import {
  buildParticleTextureConfigs,
} from "../../particles/config";
import { SidewaysParticlesRenderer } from "../particles/sideways";
import { StarTravelParticlesRenderer } from "../particles/star-travel";

type ParticleLayer = Extract<RenderLayer, { kind: "particles" }>;

type ParticleRenderer =
  | SidewaysParticlesRenderer
  | StarTravelParticlesRenderer;

const SPECTERR_PARTICLE_BASS_SPECTRUM_OPTIONS: ProcessSpectrumOptions = {
  loop: false,
  maxShiftPasses: 0,
  smoothed: true,
  smoothingPasses: 4,
  smoothingPoints: 5,
};

function hasRenderableParticles(layer: ParticleLayer | null) {
  if (!layer) {
    return false;
  }

  const particleTextures = buildParticleTextureConfigs(layer.props.particles);
  return particleTextures.some((particle) => (particle.birthRate ?? 0) > 0);
}

function normalizeDirection(direction: string | null | undefined) {
  return (direction ?? "up").trim().toUpperCase();
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
    const direction = layer
      ? normalizeDirection(layer.props.particles.direction)
      : this.rendererDirection;

    this.ensureRenderer(direction);
    this.renderer.container.visible = Boolean(layer);
    this.renderer.updateSurface(input.surface);
    this.renderer.update(
      {
        enabled: hasRenderableParticles(layer),
        particleTextures: buildParticleTextureConfigs(layer?.props.particles),
        spectrumOptions: SPECTERR_PARTICLE_BASS_SPECTRUM_OPTIONS,
        speedUpEnabled: Boolean(layer?.props.particles.speedUpEnabled),
      },
      input.frameContext.fps,
    );
    this.renderer.draw(layer?.props.bassSpectrum ?? new Float32Array());
  }

  destroy() {
    this.renderer.destroy();
  }
}
