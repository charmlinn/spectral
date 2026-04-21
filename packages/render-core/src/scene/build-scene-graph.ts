import type {
  BuildSceneGraphInput,
  LyricsLayerProps,
  RenderLayer,
  RenderSceneGraph,
} from "../contracts/render";
import { getSpectrumForFrame, getAverageAmplitude } from "../visualizer/analysis";

function getActiveLyricsProps(input: BuildSceneGraphInput): LyricsLayerProps {
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
  const backdropAssetId = input.project.backdrop.source?.assetId ?? null;
  const spectrum = getSpectrumForFrame(input.analysisProvider, input.frameContext);
  const layers: RenderLayer[] = [
    {
      id: "backdrop",
      kind: "backdrop",
      zIndex: 0,
      startMs: 0,
      endMs: null,
      props: {
        viewport: input.project.viewport,
        assetId: backdropAssetId,
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
        amplitude: getAverageAmplitude(spectrum),
      },
    });
  }

  layers.push({
    id: "lyrics",
    kind: "lyrics",
    zIndex: 20,
    startMs: 0,
    endMs: null,
    props: getActiveLyricsProps(input),
  });

  for (const layer of input.project.textLayers) {
    layers.push({
      id: layer.id,
      kind: "text",
      zIndex: 30,
      startMs: layer.startMs,
      endMs: layer.endMs,
      props: {
        layer,
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
