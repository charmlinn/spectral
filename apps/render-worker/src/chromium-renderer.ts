import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { RenderSession } from "@spectral/render-session";
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
  result?: {
    type?: string;
    value?: T;
    unserializableValue?: string;
    description?: string;
  };
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
      value?: unknown;
    };
  };
};

type CDPNavigateResult = {
  frameId?: string;
  loaderId?: string;
  errorText?: string;
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
      "--allow-file-access-from-files",
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

    if (!evaluation.result) {
      return undefined as T;
    }

    if (evaluation.result.unserializableValue !== undefined) {
      return evaluation.result.unserializableValue as T;
    }

    if (evaluation.result.value !== undefined) {
      return evaluation.result.value;
    }

    if (evaluation.result.type === "undefined") {
      return undefined as T;
    }

    throw new Error(
      evaluation.result.description ??
        `Chromium evaluation returned a non-serializable ${evaluation.result.type ?? "value"}.`,
    );
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

async function waitForOfflineRuntimeReady(client: CDPClient): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < 30_000) {
    try {
      const ready = await client.evaluate<boolean>(`
        (() => {
          return Boolean(
            document.getElementById("stage") &&
            window.spectralRuntime &&
            window.__spectralOfflineRuntimeReady
          );
        })()
      `);

      if (ready) {
        await client.evaluate(`
          (async () => {
            await window.__spectralOfflineRuntimeReady;
          })()
        `);
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(200);
  }

  throw new Error(
    `Offline runtime did not expose window.spectralRuntime in time${lastError ? `; last error: ${describeError(lastError)}` : ""}.`,
  );
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

    const navigation = await client.send<CDPNavigateResult>("Page.navigate", {
      url: options.renderPageUrl,
    });

    if (navigation.errorText) {
      throw new Error(
        `Chromium failed to navigate to ${options.renderPageUrl}: ${navigation.errorText}`,
      );
    }

    benchmark.mark("page_navigated");

    await waitForOfflineRuntimeReady(client);
    const sessionForRender = options.sessionOverride ?? options.session;

    await client.evaluate(`
      (async () => {
        await window.__spectralOfflineRuntimeReady;

        const runtime = window.spectralRuntime;

        if (!runtime) {
          throw new Error("Spectral offline runtime is unavailable.");
        }

        await runtime.loadSession(${toExpressionPayload(sessionForRender)});
        await runtime.renderFrame(0);
      })()
    `);
    benchmark.mark("renderer_warm");

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
          const runtime = window.spectralRuntime;

          if (!runtime) {
            throw new Error("Spectral offline runtime is unavailable while rendering.");
          }

          const result = await runtime.renderFrame(${frame});

          return {
            renderMs: result.renderMs,
          };
        })()
      `);
      const pngDataUrl = await client.evaluate<string>(`
        (async () => {
          const runtime = window.spectralRuntime;

          if (!runtime) {
            throw new Error("Spectral offline runtime is unavailable while capturing.");
          }

          return runtime.captureFrame({ format: "png" });
        })()
      `);

      if (!pngDataUrl.startsWith("data:image/png;base64,")) {
        throw new Error("Render canvas capture returned an unexpected payload.");
      }

      const frameBytes = Buffer.from(
        pngDataUrl.replace(/^data:image\/png;base64,/, ""),
        "base64",
      );
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
