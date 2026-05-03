"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Pause, Play, Settings, Volume2 } from "lucide-react";

import {
  type AudioAnalysisProvider,
  type AudioAnalysisSnapshot,
} from "@spectral/audio-analysis";
import {
  usePlaybackStore,
  usePreviewStore,
  useProjectStore,
} from "@spectral/editor-store";
import type {
  SupportedAspectRatio,
  VideoProject,
} from "@spectral/project-schema";
import {
  createHtmlMediaElementClock,
  createManualRenderClock,
  createSpectralRuntimeSession,
  type BrowserRenderRuntime,
} from "@spectral/render-runtime-browser";
import { Button } from "@spectral/ui/components/button";

import {
  createProjectAssetResolver,
  resolveProjectAudioUrl,
} from "@/src/lib/editor-runtime";

type PreviewStageProps = {
  analysisError: string | null;
  analysisLoading: boolean;
  analysisProvider: AudioAnalysisProvider | null;
  analysisSnapshot: AudioAnalysisSnapshot | null;
};

const SPECTERR_PREVIEW_FRAME_CONTEXT_FPS = 60;

function toAspectRatioValue(aspectRatio: SupportedAspectRatio) {
  if (aspectRatio === "9:16") {
    return "9 / 16";
  }

  if (aspectRatio === "16:9") {
    return "16 / 9";
  }

  return "1 / 1";
}

function getPreviewResolution(renderQuality: "draft" | "balanced" | "high") {
  if (renderQuality === "draft") {
    return 240;
  }

  if (renderQuality === "balanced") {
    return 480;
  }

  return 720;
}

function getPreviewSurfaceDimensions(
  aspectRatio: SupportedAspectRatio,
  renderQuality: "draft" | "balanced" | "high",
) {
  const previewResolution = getPreviewResolution(renderQuality);

  if (aspectRatio === "9:16") {
    return {
      width: previewResolution,
      height: (previewResolution * 16) / 9,
    };
  }

  if (aspectRatio === "16:9") {
    return {
      width: (previewResolution * 16) / 9,
      height: previewResolution,
    };
  }

  return {
    width: previewResolution,
    height: previewResolution,
  };
}

function createPreviewClock(
  audioElement: HTMLAudioElement | null,
  audioUrl: string | null,
  fps: number,
  fallbackClock: ReturnType<typeof createManualRenderClock>,
) {
  if (audioUrl && audioElement) {
    return createHtmlMediaElementClock(audioElement, fps);
  }

  return fallbackClock;
}

function projectRequiresAudioAnalysis(project: VideoProject) {
  return (
    project.visualizer.enabled ||
    project.backdrop.bounceEnabled ||
    project.backdrop.shakeEnabled ||
    project.backdrop.zoomBlurEnabled ||
    project.overlays.particles.enabled ||
    project.overlays.particles.speedUpEnabled ||
    (Array.isArray(project.overlays.particles.items) &&
      project.overlays.particles.items.some((item) => (item.birthRate ?? 0) > 0))
  );
}

export function PreviewStage({
  analysisError,
  analysisLoading,
  analysisProvider,
  analysisSnapshot,
}: PreviewStageProps) {
  const project = useProjectStore((state) => state.project);
  const playing = usePlaybackStore((state) => state.playing);
  const currentTimeMs = usePlaybackStore((state) => state.currentTimeMs);
  const muted = usePlaybackStore((state) => state.muted);
  const playbackRate = usePlaybackStore((state) => state.playbackRate);
  const play = usePlaybackStore((state) => state.play);
  const pause = usePlaybackStore((state) => state.pause);
  const seekToMs = usePlaybackStore((state) => state.seekToMs);
  const viewportWidth = usePreviewStore((state) => state.viewportWidth);
  const viewportHeight = usePreviewStore((state) => state.viewportHeight);
  const previewAspectRatio = usePreviewStore((state) => state.aspectRatio);
  const renderQuality = usePreviewStore((state) => state.renderQuality);
  const runtimeHealth = usePreviewStore((state) => state.runtimeHealth);
  const deviceDpr = usePreviewStore((state) => state.dpr);
  const setSurface = usePreviewStore((state) => state.setSurface);
  const setRuntimeHealth = usePreviewStore((state) => state.setRuntimeHealth);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runtimeRef = useRef<BrowserRenderRuntime | null>(null);
  const manualClockRef = useRef(
    createManualRenderClock({ fps: SPECTERR_PREVIEW_FRAME_CONTEXT_FPS }),
  );
  const assetResolverRef = useRef(createProjectAssetResolver());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const renderSurface = getPreviewSurfaceDimensions(
    previewAspectRatio,
    renderQuality,
  );
  const effectiveDpr = Math.max(1, Math.min(deviceDpr || 1, 2));
  const requiresAudioAnalysis = projectRequiresAudioAnalysis(project);
  const canRenderRuntime = !requiresAudioAnalysis || analysisProvider !== null;

  useEffect(() => {
    const element = frameRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setSurface(
        entry.contentRect.width,
        entry.contentRect.height,
        window.devicePixelRatio || 1,
      );
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [setSurface]);

  useEffect(() => {
    if (!project.audio.assetId && !project.audio.source?.url) {
      setAudioUrl(null);
      return;
    }

    let cancelled = false;

    void resolveProjectAudioUrl({
      assetId: project.audio.assetId,
      source: project.audio.source,
    })
      .then((url) => {
        if (!cancelled) {
          setAudioUrl(url);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRuntimeError(
            error instanceof Error
              ? error.message
              : "Failed to resolve audio asset.",
          );
          setRuntimeHealth("error");
          setAudioUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.audio.assetId, project.audio.source?.url, setRuntimeHealth]);

  useEffect(() => {
    runtimeRef.current?.setHistoryProvider(analysisProvider);
  }, [analysisProvider, analysisSnapshot]);

  useEffect(() => {
    if (runtimeRef.current) {
      return;
    }

    if (!canRenderRuntime) {
      setRuntimeHealth(analysisLoading ? "idle" : "warning");
      return;
    }

    const target = stageRef.current;

    if (!target || renderSurface.width <= 0 || renderSurface.height <= 0) {
      return;
    }

    let disposed = false;

    const initializeRuntime = async () => {
      try {
        setRuntimeError(null);

        const runtime = await createSpectralRuntimeSession({
          project,
          surface: {
            width: renderSurface.width,
            height: renderSurface.height,
            dpr: effectiveDpr,
          },
          frameContextFps: SPECTERR_PREVIEW_FRAME_CONTEXT_FPS,
          clock: createPreviewClock(
            audioRef.current,
            audioUrl,
            SPECTERR_PREVIEW_FRAME_CONTEXT_FPS,
            manualClockRef.current,
          ),
          analysisProvider,
          historyProvider: analysisProvider,
          assetResolver: assetResolverRef.current,
          autoStart: false,
          mode: "preview",
          target,
        });

        if (disposed) {
          await runtime.unmount();
          return;
        }

        runtimeRef.current = runtime;
        runtime.setPlaybackState(playing);
        setRuntimeHealth(analysisError ? "warning" : "ready");
        await runtime.renderFrameAt(currentTimeMs);
      } catch (error) {
        setRuntimeError(
          error instanceof Error
            ? error.message
            : "Failed to bootstrap preview runtime.",
        );
        setRuntimeHealth("error");
      }
    };

    void initializeRuntime();

    return () => {
      disposed = true;
    };
  }, [
    analysisLoading,
    analysisProvider,
    audioUrl,
    canRenderRuntime,
    effectiveDpr,
    project.projectId,
    renderSurface.height,
    renderSurface.width,
    setRuntimeHealth,
  ]);

  useEffect(() => {
    return () => {
      if (runtimeRef.current) {
        void runtimeRef.current.unmount();
        runtimeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }

    runtimeRef.current.setClock(
      createPreviewClock(
        audioRef.current,
        audioUrl,
        SPECTERR_PREVIEW_FRAME_CONTEXT_FPS,
        manualClockRef.current,
      ),
    );
  }, [audioUrl]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }

    if (!canRenderRuntime) {
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      runtime.stop();
      setRuntimeHealth(analysisLoading ? "idle" : "warning");
      void runtime.unmount();
      return;
    }

    runtimeRef.current.setProject(project);
    runtimeRef.current.setAudioAnalysisProvider(analysisProvider);
    runtimeRef.current.setHistoryProvider(analysisProvider);
    runtimeRef.current.setAssetResolver(assetResolverRef.current);
  }, [
    analysisLoading,
    analysisProvider,
    canRenderRuntime,
    project,
    setRuntimeHealth,
  ]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }

    runtimeRef.current.setPlaybackState(playing);
  }, [playing]);

  useEffect(() => {
    if (!runtimeRef.current || playing || !canRenderRuntime) {
      return;
    }

    void runtimeRef.current.renderFrameAt(currentTimeMs);
  }, [canRenderRuntime, currentTimeMs, playing]);

  useEffect(() => {
    if (!runtimeRef.current || runtimeError) {
      return;
    }

    setRuntimeHealth(analysisError ? "warning" : "ready");
  }, [analysisError, runtimeError, setRuntimeHealth]);

  const startAudioPreview = useEffectEvent(async () => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      throw new Error("Preview audio element is not available.");
    }

    await audioElement.play();
  });

  const stopAudioPreview = useEffectEvent(() => {
    audioRef.current?.pause();
  });

  useEffect(() => {
    if (
      !runtimeRef.current ||
      !canRenderRuntime ||
      renderSurface.width <= 0 ||
      renderSurface.height <= 0
    ) {
      return;
    }

    void (async () => {
      await runtimeRef.current?.setSurface({
        width: renderSurface.width,
        height: renderSurface.height,
        dpr: effectiveDpr,
      });

      if (!playing) {
        await runtimeRef.current?.renderFrameAt(currentTimeMs);
      }
    })();
  }, [
    canRenderRuntime,
    effectiveDpr,
    playing,
    renderSurface.height,
    renderSurface.width,
  ]);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.muted = muted;
    audioElement.playbackRate = playbackRate;
  }, [muted, playbackRate]);

  useEffect(() => {
    if (!audioUrl || !audioRef.current) {
      return;
    }

    if (Math.abs(audioRef.current.currentTime - currentTimeMs / 1000) > 0.05) {
      audioRef.current.currentTime = currentTimeMs / 1000;
    }
  }, [audioUrl, currentTimeMs]);

  useEffect(() => {
    if (playing) {
      if (!canRenderRuntime) {
        pause();
        return;
      }

      if (audioUrl && audioRef.current) {
        runtimeRef.current?.start();
        void startAudioPreview().catch((error: unknown) => {
          runtimeRef.current?.setHistoryProvider(analysisProvider);
          setRuntimeError(
            error instanceof Error
              ? error.message
              : "Failed to start preview playback.",
          );
          setRuntimeHealth("error");
          pause();
        });
        return;
      }

      manualClockRef.current.seekToMs(currentTimeMs);
      void runtimeRef.current?.renderFrameAt(currentTimeMs);
    } else {
      runtimeRef.current?.stop();
      stopAudioPreview();
      manualClockRef.current.seekToMs(currentTimeMs);
      if (canRenderRuntime) {
        void runtimeRef.current?.renderFrameAt(currentTimeMs);
      }
    }
  }, [
    analysisProvider,
    audioUrl,
    canRenderRuntime,
    currentTimeMs,
    pause,
    playing,
    setRuntimeHealth,
    startAudioPreview,
    stopAudioPreview,
  ]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    let rafId = 0;
    let previousTime = performance.now();

    const tick = (now: number) => {
      if (audioUrl && audioRef.current) {
        seekToMs(audioRef.current.currentTime * 1000, project.timing.fps);

        if (audioRef.current.ended) {
          pause();
          return;
        }
      } else {
        const deltaMs = (now - previousTime) * playbackRate;
        previousTime = now;
        const nextTimeMs = Math.min(
          project.timing.durationMs,
          usePlaybackStore.getState().currentTimeMs + deltaMs,
        );

        manualClockRef.current.seekToMs(nextTimeMs);
        seekToMs(nextTimeMs, project.timing.fps);
        if (canRenderRuntime) {
          void runtimeRef.current?.renderFrameAt(nextTimeMs);
        }

        if (nextTimeMs >= project.timing.durationMs) {
          pause();
          return;
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    audioUrl,
    canRenderRuntime,
    pause,
    playbackRate,
    playing,
    project.timing.durationMs,
    project.timing.fps,
    seekToMs,
  ]);

  const formattedCurrentTime = `${Math.floor(currentTimeMs / 60000)}:${String(
    Math.floor((currentTimeMs % 60000) / 1000),
  ).padStart(2, "0")}`;
  const formattedDuration = `${Math.floor(project.timing.durationMs / 60000)}:${String(
    Math.floor((project.timing.durationMs % 60000) / 1000),
  ).padStart(2, "0")}`;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#181a1f]">
      <div className="flex min-h-0 flex-1 items-center justify-center p-5">
        <div className="flex size-full items-center justify-center bg-[#111216] p-4 shadow-inner shadow-black/40">
          <div
            ref={frameRef}
            className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden bg-black shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9)]"
            style={{
              aspectRatio: toAspectRatioValue(previewAspectRatio),
              height: previewAspectRatio === "9:16" ? "100%" : "auto",
              maxHeight: "100%",
              width: previewAspectRatio === "9:16" ? "auto" : "100%",
            }}
          >
            <div ref={stageRef} className="size-full" />
            {runtimeHealth !== "ready" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/65 px-6 text-center text-sm text-white/76">
                {runtimeError ??
                  (analysisLoading
                    ? "Loading audio analysis..."
                    : "Initializing preview...")}
              </div>
            ) : null}
            <audio
              ref={audioRef}
              className="hidden"
              crossOrigin="anonymous"
              playsInline
              preload="auto"
              src={audioUrl ?? undefined}
            />
          </div>
        </div>
      </div>

      <footer className="flex h-20 shrink-0 items-center gap-4 border-t border-white/10 bg-[#2b2d32] px-5">
        <Button
          className="size-11 rounded-full bg-red-500 text-white hover:bg-red-400"
          size="icon"
          onClick={() => (playing ? pause() : play())}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Volume2 className="size-5 text-white/50" />
        <span className="w-24 text-sm font-medium text-white/74">
          {formattedCurrentTime} / {formattedDuration}
        </span>
        <div className="h-px flex-1 bg-red-400/40" />
        <div className="hidden items-center gap-3 text-xs text-white/42 md:flex">
          <span>{previewAspectRatio}</span>
          <span>{viewportWidth} x {viewportHeight}</span>
          <span>{renderQuality}</span>
        </div>
        {(analysisError || runtimeError) ? (
          <span className="max-w-64 truncate text-xs text-red-300">
            {runtimeError ?? analysisError}
          </span>
        ) : null}
        <Button className="text-white/80 hover:bg-white/8 hover:text-white" size="icon" variant="ghost">
          <Settings className="size-5" />
          <span className="sr-only">Preview settings</span>
        </Button>
      </footer>
    </section>
  );
}
