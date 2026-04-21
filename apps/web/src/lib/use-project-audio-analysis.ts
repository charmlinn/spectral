"use client";

import { useEffect, useState } from "react";

import type { AudioAnalysisProvider } from "@spectral/audio-analysis";

import { getAudioAnalysis } from "./editor-api";
import { createAudioAnalysisProviderFromDto } from "./editor-runtime";

type AnalysisState = {
  provider: AudioAnalysisProvider | null;
  loading: boolean;
  error: string | null;
};

const emptyState: AnalysisState = {
  provider: null,
  loading: false,
  error: null,
};

export function useProjectAudioAnalysis(analysisId: string | null | undefined) {
  const [state, setState] = useState<AnalysisState>(emptyState);

  useEffect(() => {
    if (!analysisId) {
      setState(emptyState);
      return;
    }

    let cancelled = false;

    setState({
      provider: null,
      loading: true,
      error: null,
    });

    void getAudioAnalysis(analysisId)
      .then((analysis) => {
        if (cancelled) {
          return;
        }

        setState({
          provider: createAudioAnalysisProviderFromDto(analysis),
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          provider: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load audio analysis.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  return state;
}

