import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  analyzeAudioChannelData,
  AUDIO_ANALYZER_CONSTANTS,
} from "@spectral/audio-analysis";
import { disconnectDataLayer, getDataLayer } from "@spectral/db";

type Options = {
  assetId: string;
  inputPath: string;
  durationMs: number;
  fps: number;
  sampleRate: number;
  channels: number;
  analyzerVersion: string;
};

function readOptions(argv: string[]): Options {
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      continue;
    }

    flags.set(key, value);
    index += 1;
  }

  const assetId = flags.get("--asset-id");
  const inputPath = flags.get("--input");

  if (!assetId || !inputPath) {
    throw new Error("Usage: regenerate-audio-analysis --asset-id <uuid> --input <path>");
  }

  return {
    assetId,
    inputPath,
    durationMs: Number(flags.get("--duration-ms") ?? 15_000),
    fps: Number(flags.get("--fps") ?? 60),
    sampleRate: Number(flags.get("--sample-rate") ?? 48_000),
    channels: Number(flags.get("--channels") ?? 2),
    analyzerVersion: flags.get("--analyzer-version") ?? "spectral-browser-v2",
  };
}

function decodeAudioToFloat32(input: Options): Buffer {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input.inputPath,
      "-t",
      String(input.durationMs / 1000),
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "-ac",
      String(input.channels),
      "-ar",
      String(input.sampleRate),
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 256 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed: ${result.stderr?.toString("utf8") ?? "unknown error"}`,
    );
  }

  return result.stdout;
}

function deinterleavePcm(buffer: Buffer, channels: number): Float32Array[] {
  const sampleCount = Math.floor(buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
  const frames = Math.floor(sampleCount / channels);
  const output = Array.from({ length: channels }, () => new Float32Array(frames));
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      output[channel]![frame] = view.getFloat32(
        (frame * channels + channel) * Float32Array.BYTES_PER_ELEMENT,
        true,
      );
    }
  }

  return output;
}

function serializeSpectrumFrames(
  frames: ReturnType<typeof analyzeAudioChannelData>["wideSpectrumFrames"],
) {
  return frames.map((frame) => ({
    frame: frame.frame,
    timeMs: frame.timeMs,
    values: Array.from(frame.values),
  }));
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  await readFile(options.inputPath);

  const pcm = decodeAudioToFloat32(options);
  const channels = deinterleavePcm(pcm, options.channels);
  const snapshot = analyzeAudioChannelData(
    {
      channels,
      sampleRate: options.sampleRate,
      durationMs: options.durationMs,
    },
    {
      fps: options.fps,
    },
  );
  const dataLayer = getDataLayer();
  const analysis = await dataLayer.audioAnalysisRepository.upsertAnalysis({
    assetId: options.assetId,
    analyzerVersion: options.analyzerVersion,
    durationMs: options.durationMs,
    sampleRate: options.sampleRate,
    channelCount: options.channels,
    sampleCount: channels[0]?.length ?? 0,
    waveformJson: snapshot.waveform,
    spectrumJson: {
      bassSpectrumFrames: serializeSpectrumFrames(snapshot.bassSpectrumFrames),
      wideSpectrumFrames: serializeSpectrumFrames(snapshot.wideSpectrumFrames),
      magnitudes: snapshot.magnitudes,
    },
    metadata: {
      status: "ready",
      generatedBy: "regenerate-audio-analysis",
      fps: options.fps,
      bassMaxMagnitude: snapshot.magnitudes.bass,
      wideMaxMagnitude: snapshot.magnitudes.wide,
      maxMagnitudeAnalysisFps: AUDIO_ANALYZER_CONSTANTS.maxMagnitudeAnalysisFps,
      updatedAt: new Date().toISOString(),
    },
  });

  await disconnectDataLayer();

  console.log("Regenerated audio analysis.", {
    analysisId: analysis.id,
    assetId: options.assetId,
    bassFrames: snapshot.bassSpectrumFrames.length,
    wideFrames: snapshot.wideSpectrumFrames.length,
    durationMs: options.durationMs,
    fps: options.fps,
  });
}

void main().catch(async (error) => {
  await disconnectDataLayer().catch(() => {});
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
