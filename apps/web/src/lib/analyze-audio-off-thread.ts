"use client";

import {
  analyzeAudioBuffer,
  type AnalyzeAudioBufferOptions,
  type AudioAnalysisSnapshot,
} from "@spectral/audio-analysis";

type WorkerSuccess = {
  ok: true;
  requestId: string;
  snapshot: AudioAnalysisSnapshot;
};

type WorkerFailure = {
  error: string;
  ok: false;
  requestId: string;
};

type WorkerResponse = WorkerSuccess | WorkerFailure;

function createWorker() {
  return new Worker(new URL("../workers/audio-analysis.worker.ts", import.meta.url), {
    type: "module",
  });
}

function copyChannels(audioBuffer: AudioBuffer) {
  return Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channelIndex) =>
      new Float32Array(audioBuffer.getChannelData(channelIndex)).buffer,
  );
}

export async function analyzeAudioBufferOffThread(
  audioBuffer: AudioBuffer,
  options: AnalyzeAudioBufferOptions = {},
): Promise<AudioAnalysisSnapshot> {
  if (typeof Worker === "undefined") {
    return analyzeAudioBuffer(audioBuffer, options);
  }

  const worker = createWorker();
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  try {
    const snapshot = await new Promise<AudioAnalysisSnapshot>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const payload = event.data;

        if (!payload || payload.requestId !== requestId) {
          return;
        }

        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);

        if (payload.ok) {
          resolve(payload.snapshot);
          return;
        }

        reject(new Error(payload.error));
      };

      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        reject(event.error ?? new Error(event.message || "Audio worker failed."));
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);

      const channels = copyChannels(audioBuffer);

      worker.postMessage(
        {
          channels,
          durationMs: Math.round(audioBuffer.duration * 1000),
          fps: options.fps ?? 30,
          requestId,
          sampleRate: audioBuffer.sampleRate,
          waveformPoints: options.waveformPoints,
        },
        channels,
      );
    });

    return snapshot;
  } finally {
    worker.terminate();
  }
}
