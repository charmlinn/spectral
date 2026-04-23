import type { ExportJobStage, RenderSession } from "@spectral/render-session";

import type { RenderWorkerSessionClient } from "./session-client";

export type HeartbeatActivity = {
  stage: ExportJobStage | null;
  progressPct?: number | null;
  message?: string | null;
  details?: Record<string, unknown>;
};

export class HeartbeatReporter {
  private readonly session: RenderSession;
  private readonly sessionClient: RenderWorkerSessionClient;
  private readonly workerId: string;
  private readonly attempt: number;
  private readonly intervalMs: number;
  private readonly state: HeartbeatActivity;
  private lastActivityAt = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private inflight: Promise<void> | null = null;
  private pendingError: unknown = null;

  constructor(input: {
    session: RenderSession;
    sessionClient: RenderWorkerSessionClient;
    workerId: string;
    attempt: number;
    intervalMs: number;
    initialState: HeartbeatActivity;
  }) {
    this.session = input.session;
    this.sessionClient = input.sessionClient;
    this.workerId = input.workerId;
    this.attempt = input.attempt;
    this.intervalMs = input.intervalMs;
    this.state = {
      stage: input.initialState.stage,
      progressPct: input.initialState.progressPct ?? null,
      message: input.initialState.message ?? null,
      details: input.initialState.details ?? {},
    };
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.flush();
    }, this.intervalMs);

    this.timer.unref?.();
  }

  noteActivity(input: HeartbeatActivity, options: { activeSignal?: boolean } = {}) {
    this.state.stage = input.stage;

    if (input.progressPct !== undefined) {
      this.state.progressPct = input.progressPct;
    }

    if (input.message !== undefined) {
      this.state.message = input.message;
    }

    if (input.details !== undefined) {
      this.state.details = input.details;
    }

    if (options.activeSignal !== false) {
      this.lastActivityAt = Date.now();
    }
  }

  ensureHealthy() {
    if (this.pendingError) {
      throw this.pendingError;
    }
  }

  async flush(force = false): Promise<void> {
    this.ensureHealthy();

    if (!force && Date.now() - this.lastActivityAt < this.intervalMs) {
      return;
    }

    if (this.inflight) {
      await this.inflight;
      return;
    }

    this.inflight = this.sessionClient
      .reportHeartbeat(this.session, {
        workerId: this.workerId,
        attempt: this.attempt,
        heartbeatAt: new Date().toISOString(),
        stage: this.state.stage,
        progressPct: this.state.progressPct ?? null,
        message: this.state.message ?? null,
        details: this.state.details ?? {},
      })
      .then(() => {
        this.lastActivityAt = Date.now();
      })
      .catch((error) => {
        this.pendingError = error;
        throw error;
      })
      .finally(() => {
        this.inflight = null;
      });

    await this.inflight;
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.inflight) {
      await this.inflight;
    }
  }
}
