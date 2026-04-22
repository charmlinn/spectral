import type {
  BuildSceneGraphInput,
  RenderLayer,
  RenderSceneGraph,
} from "../contracts/render";
import { getSpectrumForFrame, getAverageAmplitude } from "../visualizer/analysis";

function getBassSpectrum(spectrum: Float32Array): Float32Array {
  return spectrum.slice(0, Math.max(12, Math.floor(spectrum.length * 0.18)));
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
  const bassSpectrum = getBassSpectrum(spectrum);
  const amplitude = getAverageAmplitude(spectrum);
  const bassAmplitude = getAverageAmplitude(bassSpectrum);
  const layers: RenderLayer[] = [
    {
      id: "backdrop",
      kind: "backdrop",
      zIndex: 0,
      startMs: 0,
      endMs: null,
      props: {
        viewport: input.project.viewport,
        source: input.project.backdrop.source,
        sourceKind: input.project.backdrop.source?.kind ?? null,
        bounceEnabled: input.project.backdrop.bounceEnabled,
        bounceScale: input.project.backdrop.bounceScale,
        paddingFactor: input.project.backdrop.paddingFactor,
        reflection: input.project.backdrop.reflection,
        hlsAdjustment: input.project.backdrop.hlsAdjustment,
        rotation: input.project.backdrop.rotation,
        shakeEnabled: input.project.backdrop.shakeEnabled,
        shakeFactor: input.project.backdrop.shakeFactor,
        filterEnabled: input.project.backdrop.filterEnabled,
        vignetteEnabled: input.project.backdrop.vignetteEnabled,
        maxVignette: input.project.backdrop.maxVignette,
        vignetteFactor: input.project.backdrop.vignetteFactor,
        contrastEnabled: input.project.backdrop.contrastEnabled,
        maxContrast: input.project.backdrop.maxContrast,
        contrastFactor: input.project.backdrop.contrastFactor,
        zoomBlurEnabled: input.project.backdrop.zoomBlurEnabled,
        maxZoomBlur: input.project.backdrop.maxZoomBlur,
        zoomBlurFactor: input.project.backdrop.zoomBlurFactor,
        amplitude,
        bassAmplitude,
        drift: input.project.backdrop.drift,
      },
    },
  ];

  if (input.project.visualizer.enabled) {
    layers.push({
      id: "visualizer",
      kind: "visualizer",
      zIndex: 10,
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
    zIndex: 20,
    startMs: 0,
    endMs: null,
    props: {
      ...getActiveLyricsProps(input),
      style: input.project.lyrics.style,
      amplitude,
    },
  });

  if (input.project.overlays.particles.enabled) {
    layers.push({
      id: "particles",
      kind: "particles",
      zIndex: 15,
      startMs: 0,
      endMs: null,
      props: {
        particles: input.project.overlays.particles,
        amplitude,
      },
    });
  }

  for (const layer of input.project.textLayers) {
    layers.push({
      id: layer.id,
      kind: "text",
      zIndex: 30,
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
