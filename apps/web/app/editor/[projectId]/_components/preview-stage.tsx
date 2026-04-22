"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Pause, Play, ZoomIn } from "lucide-react";

import {
  createRealtimeAudioAnalysisController,
  type AudioAnalysisProvider,
  type AudioAnalysisSnapshot,
  type RealtimeAudioAnalysisController,
} from "@spectral/audio-analysis";
import {
  usePlaybackStore,
  usePreviewStore,
  useProjectStore,
} from "@spectral/editor-store";
import type { SupportedAspectRatio } from "@spectral/project-schema";
import {
  createBrowserRenderRuntime,
  createHtmlMediaElementClock,
  createManualRenderClock,
  createSpectralPixiRenderAdapter,
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

function toAspectRatioValue(aspectRatio: SupportedAspectRatio) {
  if (aspectRatio === "9:16") {
    return "9 / 16";
  }

  if (aspectRatio === "16:9") {
    return "16 / 9";
  }

  return "1 / 1";
}

function getPreviewResolutionScale(renderQuality: "draft" | "balanced" | "high") {
  if (renderQuality === "draft") {
    return 0.75;
  }

  if (renderQuality === "balanced") {
    return 1;
  }

  return 1.5;
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
  const realtimeAnalysisRef = useRef<RealtimeAudioAnalysisController | null>(
    null,
  );
  const realtimeAnalysisReadyRef = useRef(false);
  const manualClockRef = useRef(
    createManualRenderClock({ fps: project.timing.fps }),
  );
  const assetResolverRef = useRef(createProjectAssetResolver());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const surfaceScale = getPreviewResolutionScale(renderQuality);
  const effectiveDpr = Math.max(0.75, Math.min(deviceDpr * surfaceScale, 2));

  useEffect(() => {
    manualClockRef.current = createManualRenderClock({
      fps: project.timing.fps,
    });
  }, [project.timing.fps]);

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
    const audioElement = audioRef.current;

    if (!audioElement || !audioUrl || !analysisSnapshot) {
      realtimeAnalysisReadyRef.current = false;
      runtimeRef.current?.setHistoryProvider(null);
      return;
    }

    const controller = createRealtimeAudioAnalysisController({
      audioElement,
      fps: project.timing.fps,
      waveform: analysisSnapshot.waveform,
      volume: muted ? 0 : 1,
    });

    controller.setMaxMagnitudes(analysisSnapshot.magnitudes);
    controller.setVolume(muted ? 0 : 1);
    realtimeAnalysisRef.current = controller;
    realtimeAnalysisReadyRef.current = false;
    runtimeRef.current?.setHistoryProvider(analysisProvider);

    return () => {
      if (realtimeAnalysisRef.current === controller) {
        realtimeAnalysisRef.current = null;
      }

      realtimeAnalysisReadyRef.current = false;
      runtimeRef.current?.setHistoryProvider(analysisProvider);
      void controller.destroy().catch(() => undefined);
    };
  }, [analysisProvider, analysisSnapshot, audioUrl, muted, project.timing.fps]);

  useEffect(() => {
    if (runtimeRef.current) {
      return;
    }

    const target = stageRef.current;
    const measuredWidth = frameRef.current?.clientWidth ?? surfaceWidth;
    const measuredHeight = frameRef.current?.clientHeight ?? surfaceHeight;

    if (!target || measuredWidth <= 0 || measuredHeight <= 0) {
      return;
    }

    let disposed = false;

    const initializeRuntime = async () => {
      try {
        setRuntimeError(null);

        const runtime = createBrowserRenderRuntime({
          adapter: createSpectralPixiRenderAdapter({
            assetResolver: assetResolverRef.current,
          }),
          project,
          surface: {
            width: measuredWidth,
            height: measuredHeight,
            dpr: effectiveDpr,
          },
          clock: createPreviewClock(
            audioRef.current,
            audioUrl,
            project.timing.fps,
            manualClockRef.current,
          ),
          analysisProvider,
          historyProvider: realtimeAnalysisReadyRef.current
            ? realtimeAnalysisRef.current
            : analysisProvider,
          assetResolver: assetResolverRef.current,
          autoStart: false,
        });

        await runtime.mount(target);

        if (disposed) {
          await runtime.unmount();
          return;
        }

        runtimeRef.current = runtime;
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
    analysisProvider,
    audioUrl,
    effectiveDpr,
    project.projectId,
    project.timing.fps,
    setRuntimeHealth,
    surfaceHeight,
    surfaceWidth,
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
        project.timing.fps,
        manualClockRef.current,
      ),
    );
  }, [audioUrl, project.timing.fps]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }
    runtimeRef.current.setProject(project);
    runtimeRef.current.setAudioAnalysisProvider(analysisProvider);
    runtimeRef.current.setHistoryProvider(
      realtimeAnalysisReadyRef.current
        ? realtimeAnalysisRef.current
        : analysisProvider,
    );
    runtimeRef.current.setAssetResolver(assetResolverRef.current);

    if (!playing) {
      void runtimeRef.current.renderFrameAt(currentTimeMs);
    }
  }, [analysisProvider, currentTimeMs, playing, project]);

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

    const controller = realtimeAnalysisRef.current;

    if (controller) {
      await controller.play();
      realtimeAnalysisReadyRef.current = true;
      runtimeRef.current?.setHistoryProvider(controller);
      return;
    }

    await audioElement.play();
  });

  const stopAudioPreview = useEffectEvent(() => {
    const controller = realtimeAnalysisRef.current;

    if (controller) {
      controller.pause();
      runtimeRef.current?.setHistoryProvider(
        realtimeAnalysisReadyRef.current ? controller : analysisProvider,
      );
      return;
    }

    audioRef.current?.pause();
  });

  useEffect(() => {
    if (!runtimeRef.current || surfaceWidth <= 0 || surfaceHeight <= 0) {
      return;
    }

    void (async () => {
      await runtimeRef.current?.setSurface({
        width: surfaceWidth,
        height: surfaceHeight,
        dpr: effectiveDpr,
      });

      if (!playing) {
        await runtimeRef.current?.renderFrameAt(currentTimeMs);
      }
    })();
  }, [currentTimeMs, effectiveDpr, playing, surfaceHeight, surfaceWidth]);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    const realtimeController = realtimeAnalysisRef.current;

    audioElement.muted = muted;
    audioElement.playbackRate = playbackRate;
    realtimeController?.setVolume(muted ? 0 : 1);
  }, [muted, playbackRate]);

  useEffect(() => {
    if (!audioUrl || !audioRef.current) {
      return;
    }

    if (Math.abs(audioRef.current.currentTime - currentTimeMs / 1000) > 0.05) {
      audioRef.current.currentTime = currentTimeMs / 1000;
    }

    realtimeAnalysisRef.current?.seekToMs(currentTimeMs);
  }, [audioUrl, currentTimeMs]);

  useEffect(() => {
    if (playing) {
      if (audioUrl && audioRef.current) {
        runtimeRef.current?.start();
        void startAudioPreview().catch((error: unknown) => {
          realtimeAnalysisReadyRef.current = false;
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
      void runtimeRef.current?.renderFrameAt(currentTimeMs);
    }
  }, [
    analysisProvider,
    audioUrl,
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
        void runtimeRef.current?.renderFrameAt(nextTimeMs);

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
