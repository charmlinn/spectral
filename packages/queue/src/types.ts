export const DEFAULT_EXPORT_QUEUE_TOPOLOGY = {
  exchange: "spectral.export",
  exchangeType: "topic",
  renderQueue: "spectral.export.render",
  retryQueue: "spectral.export.render.retry",
  deadQueue: "spectral.export.render.dead",
  requestRoutingKey: "export.render.request",
  retryRoutingKey: "export.render.retry",
  deadRoutingKey: "export.render.dead",
} as const;

export type ExportQueueTopology = typeof DEFAULT_EXPORT_QUEUE_TOPOLOGY;

export type ExportRenderMessage = {
  exportJobId: string;
  requestedAt: string;
};

export type ExportJobHeaders = {
  "x-retry-count"?: number;
};

export type AssertTopologyOptions = {
  retryDelayMs?: number;
  durable?: boolean;
};

export type PublishExportJobOptions = {
  persistent?: boolean;
  retryCount?: number;
};

export type ExportJobConsumeResult =
  | {
      action: "ack";
    }
  | {
      action: "retry";
      retryCount?: number;
    }
  | {
      action: "dead";
      retryCount?: number;
    };
