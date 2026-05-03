"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Pause, Play, ZoomIn } from "lucide-react";

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
import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@spectral/ui/components/card";
import { Slider } from "@spectral/ui/components/slider";

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
  const surfaceWidth = usePreviewStore((state) => state.surfaceWidth);
  const surfaceHeight = usePreviewStore((state) => state.surfaceHeight);
  const viewportWidth = usePreviewStore((state) => state.viewportWidth);
  const viewportHeight = usePreviewStore((state) => state.viewportHeight);
  const previewAspectRatio = usePreviewStore((state) => state.aspectRatio);
  const renderQuality = usePreviewStore((state) => state.renderQuality);
  const runtimeHealth = usePreviewStore((state) => state.runtimeHealth);
  const deviceDpr = usePreviewStore((state) => state.dpr);
  const setSurface = usePreviewStore((state) => state.setSurface);
  const setRenderQuality = usePreviewStore((state) => state.setRenderQuality);
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

  return (
    <Card className="surface-glow flex min-h-[26rem] flex-1 flex-col overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Preview stage</Badge>
              <Badge variant="outline">{previewAspectRatio}</Badge>
              <Badge variant="outline">
                {viewportWidth} x {viewportHeight}
              </Badge>
              <Badge variant="outline">{runtimeHealth}</Badge>
              <Badge variant="outline">{renderQuality}</Badge>
            </div>
            <div>
              <CardTitle>Live preview runtime</CardTitle>
              <CardDescription>
                `@spectral/render-runtime-browser` mounts here with the real
                project document and resolved assets.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => play()}>
              <Play className="size-4" />
              Preview
            </Button>
            <Button size="sm" variant="outline" onClick={() => pause()}>
              <Pause className="size-4" />
              Pause
            </Button>
            <div className="flex min-w-56 items-center gap-3 rounded-full border border-border bg-background/70 px-4 py-2">
              <ZoomIn className="size-4 text-muted-foreground" />
              <Slider
                max={100}
                min={0}
                step={50}
                value={[
                  renderQuality === "draft"
                    ? 0
                    : renderQuality === "balanced"
                      ? 50
                      : 100,
                ]}
                onValueChange={([value]) => {
                  if (value === undefined) {
                    return;
                  }

                  setRenderQuality(
                    value >= 100 ? "high" : value >= 50 ? "balanced" : "draft",
                  );
                }}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex h-[34rem] items-center justify-center rounded-[28px] border border-border/70 bg-slate-950/55 p-3 xl:h-[42rem]">
            <div
              ref={frameRef}
              className="relative flex w-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-[0_34px_120px_-52px_rgba(15,23,42,0.95)]"
              style={{
                aspectRatio: toAspectRatioValue(previewAspectRatio),
                maxHeight: "100%",
              }}
            >
              <div ref={stageRef} className="size-full" />
              {runtimeHealth !== "ready" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 px-6 text-center text-sm text-white/80">
                  {runtimeError ??
                    (analysisLoading
                      ? "Loading audio analysis..."
                      : "Initializing preview runtime...")}
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

          <div className="space-y-4 rounded-[28px] border border-border/70 bg-background/60 p-4">
            <div>
              <p className="text-sm font-medium">Surface</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Viewport {viewportWidth} x {viewportHeight} · Surface{" "}
                {Math.round(renderSurface.width)} x{" "}
                {Math.round(renderSurface.height)} · Display{" "}
                {Math.round(surfaceWidth)} x {Math.round(surfaceHeight)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Playback</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {Math.round(currentTimeMs)} ms / {project.timing.durationMs} ms
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Media</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Audio {project.audio.assetId ? "attached" : "missing"} ·
                Analysis{" "}
                {analysisProvider
                  ? "ready"
                  : project.audio.analysisId
                    ? "failed"
                    : "missing"}
              </p>
            </div>
            {analysisError ? (
              <p className="text-sm text-amber-600">{analysisError}</p>
            ) : null}
            {runtimeError ? (
              <p className="text-sm text-destructive">{runtimeError}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
