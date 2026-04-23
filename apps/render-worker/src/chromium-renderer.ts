import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { RenderSession } from "@spectral/render-session";
import type { RenderPageBootstrapPayload } from "@spectral/render-runtime-browser";
import {
  createBenchmarkRecorder,
  hashFrameBuffer,
  selectRenderSampleFrames,
  type RenderBenchmarkRecord,
  type RenderFrameFingerprint,
} from "@spectral/render-parity";

type ChromiumLaunchOptions = {
  executablePath: string;
  userDataDir: string;
  windowWidth: number;
  windowHeight: number;
  logFilePath: string;
};

type CDPResponseEnvelope = {
  id?: number;
  result?: unknown;
  error?: {
    message?: string;
  };
};

type CDPEventEnvelope = {
  method?: string;
  params?: Record<string, unknown>;
};

type CDPResult<T> = {
  result?: T;
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
      value?: unknown;
    };
  };
};

type CDPClient = {
  send: <T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<T>;
  waitForEvent: <T = Record<string, unknown>>(
    method: string,
    timeoutMs?: number,
  ) => Promise<T>;
  evaluate: <T = unknown>(expression: string) => Promise<T>;
  close: () => Promise<void>;
};

type CanvasClip = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type ChromiumRenderResult = {
  framesDir: string;
  framePattern: string;
  previewFramePaths: Map<number, string>;
  benchmark: RenderBenchmarkRecord;
  sampleFingerprints: RenderFrameFingerprint[];
};

type RenderFrameCallback = {
  frame: number;
  frameCount: number;
  renderMs: number;
};

export type ChromiumRendererOptions = {
  executablePath: string;
  workDir: string;
  renderPageUrl: string;
  session: RenderSession;
  sessionOverride?: RenderSession;
  throwIfCancelled?: (reason: string) => Promise<void>;
  onFrameRendered?: (frame: RenderFrameCallback) => Promise<void>;
};

function inferBrowserWindowSize(session: RenderSession) {
  return {
    width: Math.max(session.runtime.width + 64, 640),
    height: Math.max(session.runtime.height + 64, 480),
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function waitForJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return (await response.json()) as T;
      }

      lastError = new Error(
        `Chromium DevTools endpoint ${url} responded with ${response.status}.`,
      );
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for Chromium DevTools at ${url}${lastError ? `; last error: ${describeError(lastError)}` : ""}.`,
  );
}

async function getAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createNetServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a local TCP port for Chromium."));
        return;
      }

      const port = address.port;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function terminateChromiumProcess(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) {
    return;
  }

  process.kill("SIGTERM");
  const terminated = await Promise.race([
    new Promise<boolean>((resolve) => {
      process.once("exit", () => resolve(true));
    }),
    delay(1_000).then(() => false),
  ]);

  if (!terminated && process.exitCode === null && process.signalCode === null) {
    process.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      process.once("exit", () => resolve());
    });
  }
}

async function launchChromium(options: ChromiumLaunchOptions): Promise<{
  process: ChildProcess;
  port: number;
}> {
  await mkdir(options.userDataDir, { recursive: true });
  const port = await getAvailablePort();
  const child = spawn(
    options.executablePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-networking",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${options.userDataDir}`,
      `--window-size=${options.windowWidth},${options.windowHeight}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.once("exit", async (code) => {
    await writeFile(
      options.logFilePath,
      `exitCode=${code ?? 0}\nstdout:\n${stdout}\n\nstderr:\n${stderr}\n`,
      "utf8",
    ).catch(() => {});
  });

  const versionUrl = `http://127.0.0.1:${port}/json/version`;

  try {
    await waitForJson(versionUrl, 15_000);
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }

  return {
    process: child,
    port,
  };
}

async function createCDPClient(webSocketUrl: string): Promise<CDPClient> {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  const listeners = new Map<
    string,
    Array<{
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }>
  >();
  let nextMessageId = 0;

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () =>
        reject(
          new Error(
            `Failed to connect to Chromium DevTools at ${webSocketUrl}.`,
          ),
        ),
      { once: true },
    );
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(String(event.data)) as CDPResponseEnvelope &
      CDPEventEnvelope;

    if (typeof payload.id === "number") {
      const pendingRequest = pending.get(payload.id);

      if (!pendingRequest) {
        return;
      }

      pending.delete(payload.id);

      if (payload.error?.message) {
        pendingRequest.reject(new Error(payload.error.message));
        return;
      }

      pendingRequest.resolve(payload.result);
      return;
    }

    if (!payload.method) {
      return;
    }

    const methodListeners = listeners.get(payload.method);

    if (!methodListeners || methodListeners.length === 0) {
      return;
    }

    const listener = methodListeners.shift();

    if (!listener) {
      return;
    }

    clearTimeout(listener.timer);
    listener.resolve(payload.params ?? {});
  });

  socket.addEventListener("close", () => {
    const closeError = new Error("Chromium DevTools connection closed.");

    for (const [id, pendingRequest] of pending) {
      pending.delete(id);
      pendingRequest.reject(closeError);
    }

    for (const methodListeners of listeners.values()) {
      for (const listener of methodListeners) {
        clearTimeout(listener.timer);
        listener.reject(closeError);
      }
    }

    listeners.clear();
  });

  const send: CDPClient["send"] = async <T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ) => {
    nextMessageId += 1;
    const id = nextMessageId;

    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  const waitForEvent: CDPClient["waitForEvent"] = async <
    T = Record<string, unknown>,
  >(
    method: string,
    timeoutMs = 15_000,
  ) => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const methodListeners = listeners.get(method);

        if (methodListeners) {
          listeners.set(
            method,
            methodListeners.filter((listener) => listener.timer !== timer),
          );
        }

        reject(new Error(`Timed out waiting for Chromium event ${method}.`));
      }, timeoutMs);
      const methodListeners = listeners.get(method) ?? [];

      methodListeners.push({
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      listeners.set(method, methodListeners);
    });
  };
  const evaluate: CDPClient["evaluate"] = async <T = unknown>(
    expression: string,
  ) => {
    const evaluation = await send<CDPResult<T>>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (evaluation.exceptionDetails) {
      const description =
        evaluation.exceptionDetails.exception?.description ??
        evaluation.exceptionDetails.text ??
        "Chromium evaluation failed.";

      throw new Error(description);
    }

    return evaluation.result as T;
  };
  const close: CDPClient["close"] = async () => {
    socket.close();
    await delay(10);
  };

  return {
    send,
    waitForEvent,
    evaluate,
    close,
  };
}

async function connectToPage(port: number): Promise<CDPClient> {
  const targets = await waitForJson<
    Array<{
      type?: string;
      webSocketDebuggerUrl?: string;
    }>
  >(`http://127.0.0.1:${port}/json/list`);
  const pageTarget = targets.find(
    (target) =>
      target.type === "page" && typeof target.webSocketDebuggerUrl === "string",
  );

  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("Chromium did not expose a debuggable page target.");
  }

  return createCDPClient(pageTarget.webSocketDebuggerUrl);
}

async function waitForDriverReady(
  client: CDPClient,
): Promise<RenderPageBootstrapPayload> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < 30_000) {
    try {
      const bootstrap =
        await client.evaluate<RenderPageBootstrapPayload | null>(`
        (() => {
          const script = document.getElementById("spectral-render-page-bootstrap");

          if (!(script instanceof HTMLScriptElement) || !window.__spectralRenderDriver) {
            return null;
          }

          return JSON.parse(script.textContent ?? "null");
        })()
      `);

      if (bootstrap) {
        return bootstrap;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(200);
  }

  throw new Error(
    `Render page did not expose window.__spectralRenderDriver in time${lastError ? `; last error: ${describeError(lastError)}` : ""}.`,
  );
}

async function prepareRenderViewport(
  client: CDPClient,
  targetElementId: string,
  session: RenderSession,
): Promise<CanvasClip> {
  await client.evaluate(`
    (() => {
      const target = document.getElementById(${JSON.stringify(targetElementId)});

      if (!(target instanceof HTMLElement)) {
        throw new Error("Render target is not mounted.");
      }

      document.documentElement.style.margin = "0";
      document.documentElement.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.background = "transparent";
      document.body.style.overflow = "hidden";
      target.style.position = "fixed";
      target.style.left = "0";
      target.style.top = "0";
      target.style.margin = "0";
      target.style.padding = "0";
      target.style.border = "0";
      target.style.borderRadius = "0";
      target.style.width = "${session.runtime.width}px";
      target.style.height = "${session.runtime.height}px";
      target.style.background = "transparent";
      target.style.zIndex = "2147483647";
    })()
  `);

  return client.evaluate<CanvasClip>(`
    (() => {
      const canvas = document.querySelector("#${targetElementId} canvas");

      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Render page canvas is not mounted.");
      }

      const rect = canvas.getBoundingClientRect();

      return {
        x: Math.max(0, rect.left),
        y: Math.max(0, rect.top),
        width: rect.width,
        height: rect.height,
        scale: 1,
      };
    })()
  `);
}

function buildFrameFilePath(framesDir: string, frame: number): string {
  return join(framesDir, `frame-${String(frame).padStart(6, "0")}.png`);
}

function toExpressionPayload(session: RenderSession) {
  return JSON.stringify(session);
}

export async function renderWithChromium(
  options: ChromiumRendererOptions,
): Promise<ChromiumRenderResult> {
  const framesDir = join(options.workDir, "frames");
  const userDataDir = join(options.workDir, "chromium-profile");
  const logFilePath = join(options.workDir, "logs", "chromium.log");
  const { width, height } = inferBrowserWindowSize(options.session);
  const benchmark = createBenchmarkRecorder(options.session, {
    renderPageUrl: options.renderPageUrl,
    chromiumExecutablePath: options.executablePath,
  });
  const sampleFrames = selectRenderSampleFrames({
    session: options.session,
  });
  const sampleFrameLookup = new Set(sampleFrames.map((sample) => sample.frame));
  const previewFramePaths = new Map<number, string>();
  const sampleFingerprints: RenderFrameFingerprint[] = [];
  let chromiumProcess: ChildProcess | null = null;
  let client: CDPClient | null = null;

  await mkdir(framesDir, { recursive: true });

  try {
    const launched = await launchChromium({
      executablePath: options.executablePath,
      userDataDir,
      windowWidth: width,
      windowHeight: height,
      logFilePath,
    });

    chromiumProcess = launched.process;
    client = await connectToPage(launched.port);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });

    const loadEvent = client.waitForEvent("Page.loadEventFired", 30_000);
    await client.send("Page.navigate", {
      url: options.renderPageUrl,
    });
    await loadEvent;
    benchmark.mark("page_loaded");

    const bootstrap = await waitForDriverReady(client);
    const targetElementId = bootstrap.runtime.targetElementId;
    const sessionForRender = options.sessionOverride ?? options.session;

    await client.evaluate(`
      (async () => {
        const driver = window.__spectralRenderDriver;

        if (!driver) {
          throw new Error("Render driver is unavailable on the render page.");
        }

        await driver.init({
          session: ${toExpressionPayload(sessionForRender)},
          bootstrap: ${JSON.stringify(bootstrap)},
        });
        await driver.warmup(0);
      })()
    `);
    benchmark.mark("renderer_warm");

    const clip = await prepareRenderViewport(
      client,
      targetElementId,
      options.session,
    );

    for (
      let frame = 0;
      frame < options.session.runtime.frameCount;
      frame += 1
    ) {
      await options.throwIfCancelled?.(`rendering frame ${frame}`);

      const frameMetrics = await client.evaluate<{
        renderMs: number;
      }>(`
        (async () => {
          const driver = window.__spectralRenderDriver;

          if (!driver) {
            throw new Error("Render driver is unavailable while rendering.");
          }

          const result = await driver.renderFrame(${frame});
          return {
            renderMs: result.renderMs,
          };
        })()
      `);
      const screenshot = await client.send<{ data: string }>(
        "Page.captureScreenshot",
        {
          format: "png",
          clip,
          captureBeyondViewport: true,
          fromSurface: true,
        },
      );
      const frameBytes = Buffer.from(screenshot.data, "base64");
      const framePath = buildFrameFilePath(framesDir, frame);

      await writeFile(framePath, frameBytes);

      if (sampleFrameLookup.has(frame)) {
        previewFramePaths.set(frame, framePath);
        sampleFingerprints.push(hashFrameBuffer(frame, frameBytes));
      }

      await options.onFrameRendered?.({
        frame,
        frameCount: options.session.runtime.frameCount,
        renderMs: frameMetrics.renderMs,
      });
    }

    benchmark.mark("frames_rendered", {
      frameCount: options.session.runtime.frameCount,
    });

    return {
      framesDir,
      framePattern: join(framesDir, "frame-%06d.png"),
      previewFramePaths,
      benchmark: benchmark.finish({
        sampleFrameCount: sampleFingerprints.length,
      }),
      sampleFingerprints,
    };
  } finally {
    await client?.close().catch(() => {});

    if (chromiumProcess) {
      await terminateChromiumProcess(chromiumProcess).catch(() => {});
    }
  }
}
