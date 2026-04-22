"use client";

import { useEffect, useState } from "react";

import {
  createArrayAudioAnalysisProvider,
  type AudioAnalysisSnapshot,
  type AudioAnalysisProvider,
} from "@spectral/audio-analysis";

import { createAudioAnalysis, getAudioAnalysis } from "./editor-api";
import { analyzeAudioBufferOffThread } from "./analyze-audio-off-thread";
import {
  createAudioAnalysisSnapshotFromDto,
  resolveProjectAudioUrl,
  serializeAudioAnalysisSnapshot,
} from "./editor-runtime";
import { useProjectStore } from "@spectral/editor-store";
import type { VideoProject } from "@spectral/project-schema";

type AnalysisState = {
  provider: AudioAnalysisProvider | null;
  snapshot: AudioAnalysisSnapshot | null;
  loading: boolean;
  error: string | null;
};

const emptyState: AnalysisState = {
  provider: null,
  snapshot: null,
  loading: false,
  error: null,
};

const CLIENT_ANALYZER_VERSION = "spectral-browser-v1";

type UseProjectAudioAnalysisInput = {
  analysisId: string | null | undefined;
  project: VideoProject;
};

async function decodeAudioFromUrl(url: string): Promise<AudioBuffer> {
  const response = await fetch(url, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch audio source ${url}.`);
  }

  const audioContext = new AudioContext();

  try {
    const buffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(buffer);
  } finally {
    await audioContext.close();
  }
}

export function useProjectAudioAnalysis({
  analysisId,
  project,
}: UseProjectAudioAnalysisInput) {
  const [state, setState] = useState<AnalysisState>(emptyState);
  const updateAtPath = useProjectStore((store) => store.updateAtPath);
  const assetId = project.audio.assetId;
  const audioSourceUrl = project.audio.source?.url ?? null;
  const fps = project.timing.fps;

  useEffect(() => {
    if (!analysisId && !assetId) {
      setState(emptyState);
      return;
    }

    let cancelled = false;

    setState({
      provider: null,
      snapshot: null,
      loading: true,
      error: null,
    });

    const run = async () => {
      const generateAndPersistAnalysis = async () => {
        if (!assetId) {
          throw new Error("Audio asset is missing.");
        }

        const audioUrl = await resolveProjectAudioUrl({
          assetId,
          source: project.audio.source,
        });
        if (!audioUrl) {
          throw new Error("Audio source is missing a resolvable URL.");
        }

        const audioBuffer = await decodeAudioFromUrl(audioUrl);
        const snapshot = await analyzeAudioBufferOffThread(audioBuffer, {
          fps,
        });
        const persisted = await createAudioAnalysis({
          assetId,
          analyzerVersion: CLIENT_ANALYZER_VERSION,
          force: true,
          durationMs: Math.round(snapshot.waveform.durationMs),
          sampleRate: audioBuffer.sampleRate,
          channelCount: audioBuffer.numberOfChannels,
          sampleCount: audioBuffer.length,
          waveformJson: snapshot.waveform,
          spectrumJson: serializeAudioAnalysisSnapshot(snapshot).spectrumFrames,
          metadata: {
            generatedBy: "editor-preview",
            fps,
            bassMaxMagnitude: snapshot.magnitudes.bass,
            wideMaxMagnitude: snapshot.magnitudes.wide,
          },
        });

        if (cancelled) {
          return;
        }

        updateAtPath(["audio", "analysisId"], persisted.analysis.id);
        setState({
          provider: createArrayAudioAnalysisProvider(snapshot),
          snapshot,
          loading: false,
          error: null,
        });
      };

      try {
        if (analysisId) {
          try {
            const analysis = await getAudioAnalysis(analysisId);

            if (cancelled) {
              return;
            }

            const snapshot = createAudioAnalysisSnapshotFromDto(analysis);
            setState({
              provider: createArrayAudioAnalysisProvider(snapshot),
              snapshot,
              loading: false,
              error: null,
            });
            return;
          } catch (error) {
            if (!assetId) {
              throw error;
            }
          }
        }

        await generateAndPersistAnalysis();
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setState({
          provider: null,
          snapshot: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load audio analysis.",
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [analysisId, assetId, audioSourceUrl, fps, updateAtPath]);

  return state;
}
