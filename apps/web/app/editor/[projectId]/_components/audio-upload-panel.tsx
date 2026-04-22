"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { analyzeAudioBuffer } from "@spectral/audio-analysis";
import { useProjectStore } from "@spectral/editor-store";
import { Button } from "@spectral/ui/components/button";
import { Input } from "@spectral/ui/components/input";
import { Label } from "@spectral/ui/components/label";

import {
  completeAsset,
  createAssetUploadUrl,
  createAudioAnalysis,
  uploadFileToSignedUrl,
} from "@/src/lib/editor-api";
import { serializeAudioAnalysisSnapshot } from "@/src/lib/editor-runtime";

type AudioUploadPanelProps = {
  projectId: string;
};

type UploadPhase = "idle" | "preparing" | "uploading" | "completing" | "analyzing" | "ready" | "error";

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function decodeAudioFile(file: File): Promise<{
  arrayBuffer: ArrayBuffer;
  audioBuffer: AudioBuffer;
  sha256: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const sha256 = await computeSha256Hex(arrayBuffer);
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    return {
      arrayBuffer,
      audioBuffer,
      sha256,
    };
  } finally {
    await audioContext.close();
  }
}

function getPhaseLabel(phase: UploadPhase) {
  switch (phase) {
    case "preparing":
      return "Preparing audio metadata and analysis payload...";
    case "uploading":
      return "Uploading audio to object storage...";
    case "completing":
      return "Completing media asset...";
    case "analyzing":
      return "Persisting audio analysis...";
    case "ready":
      return "Audio asset and analysis are attached to the project.";
    case "error":
      return "Audio upload failed.";
    default:
      return "Select an audio file to upload, analyze, and bind to this project.";
  }
}

export function AudioUploadPanel({ projectId }: AudioUploadPanelProps) {
  const project = useProjectStore((state) => state.project);
  const applyPatch = useProjectStore((state) => state.applyPatch);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  const busy = phase === "preparing" || phase === "uploading" || phase === "completing" || phase === "analyzing";

  async function handleFileSelection(file: File) {
    setError(null);
    setLastFilename(file.name);
    setPhase("preparing");

    try {
      const { audioBuffer, sha256 } = await decodeAudioFile(file);
      const durationMs = Math.max(1, Math.round(audioBuffer.duration * 1000));
      const uploadPlan = await createAssetUploadUrl({
        projectId,
        kind: "audio",
        contentType: file.type || "audio/mpeg",
        originalFilename: file.name,
      });

      setPhase("uploading");
      await uploadFileToSignedUrl(uploadPlan.upload, file);

      setPhase("completing");
      const asset = await completeAsset({
        assetId: uploadPlan.asset.id,
        sha256,
        byteSize: file.size,
        durationMs,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        metadata: {
          uploadSource: "editor-audio-panel",
        },
      });

      const snapshot = analyzeAudioBuffer(audioBuffer, {
        fps: project.timing.fps,
      });

      setPhase("analyzing");
      const analysisResponse = await createAudioAnalysis({
        assetId: asset.id,
        analyzerVersion: "spectral-browser-v1",
        force: true,
        durationMs,
        sampleRate: audioBuffer.sampleRate,
        channelCount: audioBuffer.numberOfChannels,
        sampleCount: audioBuffer.length,
        waveformJson: snapshot.waveform,
        spectrumJson: serializeAudioAnalysisSnapshot(snapshot).spectrumFrames,
        metadata: {
          generatedBy: "editor-audio-panel",
          originalFilename: file.name,
        },
      });

      applyPatch({
        timing: {
          ...project.timing,
          durationMs,
        },
        audio: {
          ...project.audio,
          assetId: asset.id,
          source: {
            assetId: asset.id,
            storageKey: asset.storageKey,
            url: null,
            kind: "audio",
            origin: "upload",
            mimeType: asset.mimeType,
          },
          analysisId: analysisResponse.analysis.id,
          trimStartMs: 0,
          trimEndMs: durationMs,
        },
      });

      setPhase("ready");
    } catch (nextError) {
      setPhase("error");
      setError(nextError instanceof Error ? nextError.message : "Audio upload failed.");
    }
  }

  return (
    <div className="grid gap-3 rounded-[20px] border border-border/70 bg-background/50 p-3">
      <div className="space-y-1">
        <Label htmlFor="project-audio-upload">Upload audio</Label>
        <p className="text-xs text-muted-foreground">
          The file is uploaded to object storage, completed as a media asset, analyzed in the browser, and written
          back into the project document.
        </p>
      </div>

      <Input
        id="project-audio-upload"
        accept="audio/*"
        disabled={busy}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (!file) {
            return;
          }

          void handleFileSelection(file);
        }}
      />

      <div className="flex items-center gap-2 text-sm">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        <span>{getPhaseLabel(phase)}</span>
      </div>

      {lastFilename ? <p className="text-xs text-muted-foreground">Last file: {lastFilename}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button disabled={busy} type="button" variant="outline" onClick={() => document.getElementById("project-audio-upload")?.click()}>
        Choose audio file
      </Button>
    </div>
  );
}
