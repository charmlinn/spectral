import { analyzeAudioChannelData, type AudioAnalysisSnapshot } from "@spectral/audio-analysis";

type AnalyzeAudioWorkerRequest = {
  channels: ArrayBuffer[];
  durationMs: number;
  fps: number;
  requestId: string;
  sampleRate: number;
  waveformPoints?: number;
};

type AnalyzeAudioWorkerResponse =
  | {
      ok: true;
      requestId: string;
      snapshot: AudioAnalysisSnapshot;
    }
  | {
      error: string;
      ok: false;
      requestId: string;
    };

self.onmessage = (event: MessageEvent<AnalyzeAudioWorkerRequest>) => {
  const payload = event.data;

  try {
    const snapshot = analyzeAudioChannelData(
      {
        channels: payload.channels.map((buffer) => new Float32Array(buffer)),
        durationMs: payload.durationMs,
        sampleRate: payload.sampleRate,
      },
      {
        fps: payload.fps,
        waveformPoints: payload.waveformPoints,
      },
    );

    const response: AnalyzeAudioWorkerResponse = {
      ok: true,
      requestId: payload.requestId,
      snapshot,
    };

    self.postMessage(response);
  } catch (error) {
    const response: AnalyzeAudioWorkerResponse = {
      error:
        error instanceof Error ? error.message : "Audio analysis worker failed.",
      ok: false,
      requestId: payload.requestId,
    };

    self.postMessage(response);
  }
};
