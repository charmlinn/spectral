"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, ZoomIn } from "lucide-react";

import type { AudioAnalysisProvider } from "@spectral/audio-analysis";
import { usePlaybackStore, usePreviewStore, useProjectStore } from "@spectral/editor-store";
import {
  createBrowserRenderRuntime,
  createCanvas2dRenderAdapter,
  createHtmlMediaElementClock,
  createManualRenderClock,
  type BrowserRenderRuntime,
} from "@spectral/render-runtime-browser";
import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Slider } from "@spectral/ui/components/slider";

import { createProjectAssetResolver, resolveProjectAudioUrl } from "@/src/lib/editor-runtime";

type PreviewStageProps = {
  analysisError: string | null;
  analysisLoading: boolean;
  analysisProvider: AudioAnalysisProvider | null;
};

function toAspectRatioValue(aspectRatio: string) {
  if (aspectRatio === "9:16") {
    return "9 / 16";
  }

  if (aspectRatio === "16:9") {
    return "16 / 9";
  }

  return "1 / 1";
}

export function PreviewStage({
  analysisError,
  analysisLoading,
  analysisProvider,
}: PreviewStageProps) {
  const project = useProjectStore((state) => state.project);
  const playing = usePlaybackStore((state) => state.playing);
  const currentTimeMs = usePlaybackStore((state) => state.currentTimeMs);
  const muted = usePlaybackStore((state) => state.muted);
  const playbackRate = usePlaybackStore((state) => state.playbackRate);
  const play = usePlaybackStore((state) => state.play);
  const pause = usePlaybackStore((state) => state.pause);
  const seekToMs = usePlaybackStore((state) => state.seekToMs);
  const width = usePreviewStore((state) => state.width);
  const height = usePreviewStore((state) => state.height);
  const renderQuality = usePreviewStore((state) => state.renderQuality);
  const runtimeHealth = usePreviewStore((state) => state.runtimeHealth);
  const setSurface = usePreviewStore((state) => state.setSurface);
  const setRenderQuality = usePreviewStore((state) => state.setRenderQuality);
  const setRuntimeHealth = usePreviewStore((state) => state.setRuntimeHealth);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runtimeRef = useRef<BrowserRenderRuntime | null>(null);
  const manualClockRef = useRef(createManualRenderClock({ fps: project.timing.fps }));
  const assetResolverRef = useRef(createProjectAssetResolver());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    manualClockRef.current = createManualRenderClock({
      fps: project.timing.fps,
    });
  }, [project.timing.fps]);

  useEffect(() => {
    const element = stageRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setSurface(entry.contentRect.width, entry.contentRect.height, window.devicePixelRatio || 1);
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
          setRuntimeError(error instanceof Error ? error.message : "Failed to resolve audio asset.");
          setRuntimeHealth("error");
          setAudioUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.audio.assetId, project.audio.source?.url, setRuntimeHealth]);

  useEffect(() => {
    const target = stageRef.current;

    if (!target || width <= 0 || height <= 0) {
      return;
    }

    let disposed = false;

    const initializeRuntime = async () => {
      try {
        setRuntimeError(null);

        const runtime = createBrowserRenderRuntime({
          adapter: createCanvas2dRenderAdapter({
            assetResolver: assetResolverRef.current,
          }),
          project,
          surface: {
            width,
            height,
            dpr: window.devicePixelRatio || 1,
          },
          clock:
            audioUrl && audioRef.current
              ? createHtmlMediaElementClock(audioRef.current, project.timing.fps)
              : manualClockRef.current,
          analysisProvider,
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
        setRuntimeError(error instanceof Error ? error.message : "Failed to bootstrap preview runtime.");
        setRuntimeHealth("error");
      }
    };

    void initializeRuntime();

    return () => {
      disposed = true;

      if (runtimeRef.current) {
        void runtimeRef.current.unmount();
        runtimeRef.current = null;
      }
    };
  }, [
    analysisError,
    analysisProvider,
    audioUrl,
    height,
    project.projectId,
    project.timing.fps,
    setRuntimeHealth,
    width,
  ]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }

    runtimeRef.current.setProject(project);
    runtimeRef.current.setAudioAnalysisProvider(analysisProvider);
    runtimeRef.current.setAssetResolver(assetResolverRef.current);
    void runtimeRef.current.renderFrameAt(currentTimeMs);
  }, [analysisProvider, currentTimeMs, project]);

  useEffect(() => {
    if (!runtimeRef.current || width <= 0 || height <= 0) {
      return;
    }

    void runtimeRef.current.setSurface({
      width,
      height,
      dpr: window.devicePixelRatio || 1,
    });
  }, [height, width]);

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
      if (audioUrl && audioRef.current) {
        runtimeRef.current?.start();
        void audioRef.current.play().catch((error: unknown) => {
          setRuntimeError(error instanceof Error ? error.message : "Failed to start preview playback.");
          setRuntimeHealth("error");
          pause();
        });
        return;
      }

      manualClockRef.current.seekToMs(currentTimeMs);
      void runtimeRef.current?.renderFrameAt(currentTimeMs);
    } else {
      runtimeRef.current?.stop();
      audioRef.current?.pause();
      manualClockRef.current.seekToMs(currentTimeMs);
      void runtimeRef.current?.renderFrameAt(currentTimeMs);
    }
  }, [audioUrl, currentTimeMs, pause, playing, setRuntimeHealth]);

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
        const nextTimeMs = Math.min(project.timing.durationMs, usePlaybackStore.getState().currentTimeMs + deltaMs);

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
  }, [audioUrl, pause, playbackRate, playing, project.timing.durationMs, project.timing.fps, seekToMs]);

  return (
    <Card className="surface-glow flex min-h-[26rem] flex-1 flex-col overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Preview stage</Badge>
              <Badge variant="outline">{project.viewport.aspectRatio}</Badge>
              <Badge variant="outline">{runtimeHealth}</Badge>
              <Badge variant="outline">{renderQuality}</Badge>
            </div>
            <div>
              <CardTitle>Live preview runtime</CardTitle>
              <CardDescription>
                `@spectral/render-runtime-browser` mounts here with the real project document and resolved assets.
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
                value={[renderQuality === "draft" ? 0 : renderQuality === "balanced" ? 50 : 100]}
                onValueChange={([value]) => {
                  if (value === undefined) {
                    return;
                  }

                  setRenderQuality(value >= 100 ? "high" : value >= 50 ? "balanced" : "draft");
                }}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-h-[24rem] items-center justify-center rounded-[28px] border border-border/70 bg-slate-950/55 p-4">
            <div
              className="relative flex w-full max-w-4xl items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-[0_34px_120px_-52px_rgba(15,23,42,0.95)]"
              style={{ aspectRatio: toAspectRatioValue(project.viewport.aspectRatio) }}
            >
              <div ref={stageRef} className="size-full" />
              {runtimeHealth !== "ready" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 px-6 text-center text-sm text-white/80">
                  {runtimeError ?? (analysisLoading ? "Loading audio analysis..." : "Initializing preview runtime...")}
                </div>
              ) : null}
              <audio ref={audioRef} className="hidden" src={audioUrl ?? undefined} />
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-border/70 bg-background/60 p-4">
            <div>
              <p className="text-sm font-medium">Surface</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {Math.round(width)} x {Math.round(height)} px
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
                Audio {project.audio.assetId ? "attached" : "missing"} · Analysis{" "}
                {analysisProvider ? "ready" : project.audio.analysisId ? "failed" : "missing"}
              </p>
            </div>
            {analysisError ? (
              <p className="text-sm text-amber-600">{analysisError}</p>
            ) : null}
            {runtimeError ? <p className="text-sm text-destructive">{runtimeError}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
