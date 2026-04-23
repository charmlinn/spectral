import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { RenderSession } from "@spectral/render-session";

import { NonRetryableWorkerError, RetryableWorkerError } from "./errors";
import {
  fetchRenderSession,
  postRenderHeartbeat,
  postRenderStage,
  type RenderExecutionInput,
  type RenderExecutionResult,
  type RenderExecutor,
} from "./render-executor";

type BrowserPageLike = {
  goto(url: string, options?: { waitUntil?: "domcontentloaded" | "load"; timeout?: number }): Promise<unknown>;
  waitForFunction<Arg>(
    pageFunction: (arg: Arg) => unknown,
    arg: Arg,
    options?: { timeout?: number },
  ): Promise<unknown>;
  evaluate<Arg, Result>(
    pageFunction: (arg: Arg) => Result | Promise<Result>,
    arg: Arg,
  ): Promise<Result>;
  close(): Promise<void>;
};

type BrowserLike = {
  newPage(): Promise<BrowserPageLike>;
  close(): Promise<void>;
};

type ChromiumModule = {
  chromium: {
    launch(options?: {
      headless?: boolean;
      args?: string[];
      executablePath?: string;
    }): Promise<BrowserLike>;
  };
};

type CapturedFramePayload = {
  metadata: {
    frame: number;
    timeMs: number;
    width: number;
    height: number;
    renderMs: number;
    captureMs: number;
    format: "png";
    byteLength: number;
  };
  pngBase64: string;
};

const PLAYWRIGHT_MODULE_NAME = "playwright";
const DRIVER_WAIT_TIMEOUT_MS = 30_000;
const PAGE_GOTO_TIMEOUT_MS = 30_000;

function getFrameOutputDirectory(input: RenderExecutionInput): string {
  const rootDir = input.framesRootDir || path.join(tmpdir(), "spectral-render-frames");

  return path.join(
    rootDir,
    input.exportJobId,
    `attempt-${String(input.attempt).padStart(2, "0")}`,
  );
}

function toFrameFilename(frame: number): string {
  return `frame-${String(frame).padStart(6, "0")}.png`;
}

function toProgressPct(frame: number, frameCount: number): number {
  if (frameCount <= 0) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round(((frame + 1) / frameCount) * 100)));
}

async function importChromium(): Promise<ChromiumModule["chromium"]> {
  try {
    const module = (await import(PLAYWRIGHT_MODULE_NAME)) as ChromiumModule;
    return module.chromium;
  } catch (error) {
    throw new NonRetryableWorkerError(
      `Playwright is not available in render-worker runtime: ${error instanceof Error ? error.message : String(error)}`,
      "PLAYWRIGHT_UNAVAILABLE",
    );
  }
}

async function waitForRenderDriver(page: BrowserPageLike): Promise<void> {
  await page.waitForFunction(
    () => Boolean(window.__spectralRenderDriver),
    undefined,
    {
      timeout: DRIVER_WAIT_TIMEOUT_MS,
    },
  );
}

async function initializePageRenderer(
  page: BrowserPageLike,
  session: RenderSession,
): Promise<void> {
  await page.evaluate(async (renderSession) => {
    const driver = window.__spectralRenderDriver;

    if (!driver) {
      throw new Error("window.__spectralRenderDriver is not available.");
    }

    await driver.init({
      session: renderSession,
    });
  }, session);
}

async function warmupPageRenderer(page: BrowserPageLike): Promise<void> {
  await page.evaluate(async () => {
    const driver = window.__spectralRenderDriver;

    if (!driver) {
      throw new Error("window.__spectralRenderDriver is not available.");
    }

    await driver.warmup(0);
  }, undefined);
}

async function captureFrame(
  page: BrowserPageLike,
  frame: number,
): Promise<CapturedFramePayload> {
  return page.evaluate(async (nextFrame) => {
    const driver = window.__spectralRenderDriver;

    if (!driver) {
      throw new Error("window.__spectralRenderDriver is not available.");
    }

    const metadata = await driver.renderFrame(nextFrame);
    const captureStart = performance.now();
    const buffer = await driver.captureFrame("png");
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    const captureMs = performance.now() - captureStart;

    return {
      metadata: {
        ...metadata,
        captureMs,
        byteLength: bytes.byteLength,
      },
      pngBase64: btoa(binary),
    };
  }, frame);
}

export class ChromiumRenderExecutor implements RenderExecutor {
  async execute(input: RenderExecutionInput): Promise<RenderExecutionResult> {
    const chromium = await importChromium();
    const session = await fetchRenderSession(
      input.renderSessionUrl,
      input.exportJobId,
      input.internalToken,
    );
    const internalApiBaseUrl = new URL("/", input.renderSessionUrl).toString();
    const framesDirectory = getFrameOutputDirectory(input);

    await mkdir(framesDirectory, {
      recursive: true,
    });

    await postRenderStage({
      session,
      webBaseUrl: internalApiBaseUrl,
      internalToken: input.internalToken,
      workerId: input.workerId,
      attempt: input.attempt,
      stage: "renderer_warmup",
      progressPct: 0,
      message: "Launching Chromium render runtime.",
    });

    let browser: BrowserLike | null = null;
    let page: BrowserPageLike | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--use-angle=swiftshader", "--disable-dev-shm-usage"],
      });
      page = await browser.newPage();

      await page.goto(input.renderPageUrl, {
        waitUntil: "load",
        timeout: PAGE_GOTO_TIMEOUT_MS,
      });
      await waitForRenderDriver(page);
      await initializePageRenderer(page, session);
      await warmupPageRenderer(page);

      await postRenderHeartbeat({
        session,
        webBaseUrl: internalApiBaseUrl,
        internalToken: input.internalToken,
        workerId: input.workerId,
        attempt: input.attempt,
        stage: "renderer_warmup",
        progressPct: 0,
        message: "Chromium render runtime initialized.",
      });

      await postRenderStage({
        session,
        webBaseUrl: internalApiBaseUrl,
        internalToken: input.internalToken,
        workerId: input.workerId,
        attempt: input.attempt,
        stage: "rendering",
        progressPct: 0,
        message: "Rendering PNG frame sequence.",
        details: {
          frameCount: session.runtime.frameCount,
        },
      });

      let totalRenderMs = 0;
      let totalCaptureMs = 0;
      const heartbeatInterval = Math.max(1, Math.floor(session.runtime.frameCount / 20));

      for (let frame = 0; frame < session.runtime.frameCount; frame += 1) {
        const capturedFrame = await captureFrame(page, frame);
        const outputPath = path.join(framesDirectory, toFrameFilename(frame));

        await writeFile(outputPath, Buffer.from(capturedFrame.pngBase64, "base64"));

        totalRenderMs += capturedFrame.metadata.renderMs;
        totalCaptureMs += capturedFrame.metadata.captureMs;

        if (
          frame === 0 ||
          frame === session.runtime.frameCount - 1 ||
          frame % heartbeatInterval === 0
        ) {
          await postRenderHeartbeat({
            session,
            webBaseUrl: internalApiBaseUrl,
            internalToken: input.internalToken,
            workerId: input.workerId,
            attempt: input.attempt,
            stage: "rendering",
            progressPct: toProgressPct(frame, session.runtime.frameCount),
            message: `Rendered frame ${frame + 1}/${session.runtime.frameCount}.`,
            details: {
              frame,
              framePath: outputPath,
              renderMs: capturedFrame.metadata.renderMs,
              captureMs: capturedFrame.metadata.captureMs,
            },
          });
        }
      }

      return {
        metadata: {
          rendererDriver: {
            mode: "chromium-playwright-png-sequence",
            framesDirectory,
            frameCount: session.runtime.frameCount,
            width: session.runtime.width,
            height: session.runtime.height,
            fps: session.runtime.fps,
            averageRenderMs:
              session.runtime.frameCount > 0
                ? totalRenderMs / session.runtime.frameCount
                : 0,
            averageCaptureMs:
              session.runtime.frameCount > 0
                ? totalCaptureMs / session.runtime.frameCount
                : 0,
          },
        },
      };
    } catch (error) {
      if (error instanceof NonRetryableWorkerError || error instanceof RetryableWorkerError) {
        throw error;
      }

      throw new RetryableWorkerError(
        `Chromium renderer failed for ${input.exportJobId}: ${error instanceof Error ? error.message : String(error)}`,
        "CHROMIUM_RENDER_FAILED",
      );
    } finally {
      await page?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }
}
