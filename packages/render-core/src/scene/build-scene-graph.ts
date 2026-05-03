import type {
  BuildSceneGraphInput,
  RenderLayer,
  RenderSceneGraph,
} from "../contracts/render";
import { getSpectrumMagnitude, processSpectrum } from "@spectral/audio-analysis";
import { getSpectrumForFrame, getAverageAmplitude } from "../visualizer/analysis";

const SPECTERR_BACKDROP_BASS_SPECTRUM_OPTIONS = {
  loop: true,
  smoothed: true,
  smoothingPasses: 4,
  smoothingPoints: 5,
} as const;

function getCurrentBassSpectrum(input: BuildSceneGraphInput) {
  const provider = input.historyProvider ?? input.analysisProvider;

  if (!provider) {
    return new Float32Array();
  }

  return new Float32Array(provider.getCurrentBassFrequency(input.frameContext.timeMs));
}

function hasRenderableParticles(
  particles: BuildSceneGraphInput["project"]["overlays"]["particles"],
) {
  if (particles.enabled) {
    return true;
  }

  if (Array.isArray(particles.items)) {
    return particles.items.some((item) => (item.birthRate ?? 0) > 0);
  }

  return (particles.birthRate ?? 0) > 0;
}

function getActiveLyricsProps(input: BuildSceneGraphInput) {
  const { segments } = input.project.lyrics;
  const activeIndex = segments.findIndex(
    (segment) =>
      input.frameContext.timeMs >= segment.startMs &&
      input.frameContext.timeMs <= segment.endMs,
  );

  if (activeIndex < 0) {
    return {
      activeSegment: null,
      previousSegment: null,
      nextSegment: segments[0] ?? null,
    };
  }

  return {
    activeSegment: segments[activeIndex] ?? null,
    previousSegment: segments[activeIndex - 1] ?? null,
    nextSegment: segments[activeIndex + 1] ?? null,
  };
}

export function buildSceneGraph(input: BuildSceneGraphInput): RenderSceneGraph {
  const spectrum = getSpectrumForFrame(input.analysisProvider, input.frameContext);
  const bassSpectrum = getCurrentBassSpectrum(input);
  const amplitude = getAverageAmplitude(spectrum);
  const bassAmplitude = getAverageAmplitude(bassSpectrum);
  const backdropBassAmplitude = getSpectrumMagnitude(
    processSpectrum(
      Array.from(bassSpectrum),
      SPECTERR_BACKDROP_BASS_SPECTRUM_OPTIONS,
    ),
  );
  const layers: RenderLayer[] = [
    {
      id: "backdrop",
      kind: "backdrop",
      zIndex: 1,
      startMs: 0,
      endMs: null,
      props: {
        viewport: input.project.viewport,
        source: input.project.backdrop.source,
        sourceKind: input.project.backdrop.source?.kind ?? null,
        bounceEnabled:
          input.project.backdrop.shakeEnabled ||
          input.project.backdrop.bounceEnabled,
        bounceScale: input.project.backdrop.bounceScale,
        paddingFactor: input.project.backdrop.paddingFactor,
        reflection: input.project.backdrop.reflection,
        hlsAdjustment: input.project.backdrop.hlsAdjustment,
        rotation: input.project.backdrop.rotation,
        shakeEnabled: input.project.backdrop.shakeEnabled,
        shakeFactor: input.project.backdrop.shakeFactor,
        filterEnabled: input.project.backdrop.filterEnabled,
        vignetteEnabled:
          input.project.backdrop.filterEnabled ||
          input.project.backdrop.vignetteEnabled,
        maxVignette: input.project.backdrop.maxVignette,
        vignetteFactor: input.project.backdrop.vignetteFactor,
        contrastEnabled:
          input.project.backdrop.filterEnabled ||
          input.project.backdrop.contrastEnabled,
        maxContrast: input.project.backdrop.maxContrast,
        contrastFactor: input.project.backdrop.contrastFactor,
        zoomBlurEnabled:
          input.project.backdrop.shakeEnabled ||
          input.project.backdrop.zoomBlurEnabled,
        maxZoomBlur: input.project.backdrop.maxZoomBlur,
        zoomBlurFactor: input.project.backdrop.zoomBlurFactor,
        amplitude,
        bassAmplitude: backdropBassAmplitude,
        drift: input.project.backdrop.drift,
      },
    },
  ];

  if (input.project.visualizer.enabled) {
    layers.push({
      id: "visualizer",
      kind: "visualizer",
      zIndex: 3,
      startMs: 0,
      endMs: null,
      props: {
        config: input.project.visualizer,
        spectrum,
        bassSpectrum,
        amplitude,
        bassAmplitude,
      },
    });
  }

  layers.push({
    id: "lyrics",
    kind: "lyrics",
    zIndex: 5,
    startMs: 0,
    endMs: null,
    props: {
      ...getActiveLyricsProps(input),
      style: input.project.lyrics.style,
      amplitude,
    },
  });

  if (hasRenderableParticles(input.project.overlays.particles)) {
    layers.push({
      id: "particles",
      kind: "particles",
      zIndex: 2,
      startMs: 0,
      endMs: null,
      props: {
        particles: input.project.overlays.particles,
        amplitude,
        bassSpectrum,
      },
    });
  }

  for (const layer of input.project.textLayers) {
    layers.push({
      id: layer.id,
      kind: "text",
      zIndex: 4,
      startMs: layer.startMs,
      endMs: layer.endMs,
      props: {
        layer,
        amplitude,
      },
    });
  }

  return {
    project: input.project,
    frameContext: input.frameContext,
    surface: input.surface,
    layers,
  };
}
