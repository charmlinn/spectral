import type { ConfirmChannel } from "amqplib";

import { DEFAULT_EXPORT_QUEUE_TOPOLOGY, type ExportRenderMessage, type PublishExportJobOptions } from "./types";

function toMessageBuffer(message: ExportRenderMessage) {
  return Buffer.from(JSON.stringify(message), "utf8");
}

export async function publishExportJob(
  channel: ConfirmChannel,
  message: ExportRenderMessage,
  options: PublishExportJobOptions = {},
): Promise<void> {
  channel.publish(
    DEFAULT_EXPORT_QUEUE_TOPOLOGY.exchange,
    DEFAULT_EXPORT_QUEUE_TOPOLOGY.requestRoutingKey,
    toMessageBuffer(message),
    {
      contentType: "application/json",
      contentEncoding: "utf-8",
      deliveryMode: options.persistent === false ? 1 : 2,
      messageId: message.exportJobId,
      timestamp: Date.now(),
      headers: {
        "x-retry-count": options.retryCount ?? 0,
      },
    },
  );

  await channel.waitForConfirms();
}

export async function publishRetryExportJob(
  channel: ConfirmChannel,
  message: ExportRenderMessage,
  options: PublishExportJobOptions = {},
): Promise<void> {
  channel.publish(
    DEFAULT_EXPORT_QUEUE_TOPOLOGY.exchange,
    DEFAULT_EXPORT_QUEUE_TOPOLOGY.retryRoutingKey,
    toMessageBuffer(message),
    {
      contentType: "application/json",
      contentEncoding: "utf-8",
      deliveryMode: options.persistent === false ? 1 : 2,
      messageId: message.exportJobId,
      timestamp: Date.now(),
      headers: {
        "x-retry-count": options.retryCount ?? 1,
      },
    },
  );

  await channel.waitForConfirms();
}

export async function publishDeadExportJob(
  channel: ConfirmChannel,
  message: ExportRenderMessage,
  options: PublishExportJobOptions = {},
): Promise<void> {
  channel.publish(
    DEFAULT_EXPORT_QUEUE_TOPOLOGY.exchange,
    DEFAULT_EXPORT_QUEUE_TOPOLOGY.deadRoutingKey,
    toMessageBuffer(message),
    {
      contentType: "application/json",
      contentEncoding: "utf-8",
      deliveryMode: options.persistent === false ? 1 : 2,
      messageId: message.exportJobId,
      timestamp: Date.now(),
      headers: {
        "x-retry-count": options.retryCount ?? 0,
      },
    },
  );

  await channel.waitForConfirms();
}
