import type { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";

import { createConfirmChannel } from "./connection";
import { assertTopology } from "./topology";
import {
  publishDeadExportJob,
  publishRetryExportJob,
} from "./publisher";
import {
  DEFAULT_EXPORT_QUEUE_TOPOLOGY,
  type ExportJobConsumeResult,
  type ExportRenderMessage,
} from "./types";

function parseExportRenderMessage(message: ConsumeMessage): ExportRenderMessage {
  const payload = JSON.parse(message.content.toString("utf8")) as Partial<ExportRenderMessage>;

  if (!payload.exportJobId || !payload.requestedAt) {
    throw new Error("Invalid export render message payload.");
  }

  return {
    exportJobId: payload.exportJobId,
    requestedAt: payload.requestedAt,
  };
}

function getRetryCount(message: ConsumeMessage): number {
  const rawValue = message.properties.headers?.["x-retry-count"];
  return typeof rawValue === "number" ? rawValue : 0;
}

export async function consumeExportJobs(
  connection: ChannelModel,
  options: {
    prefetch?: number;
    retryDelayMs?: number;
    onMessage: (input: {
      message: ExportRenderMessage;
      retryCount: number;
    }) => Promise<ExportJobConsumeResult>;
  },
): Promise<ConfirmChannel> {
  const channel = await createConfirmChannel(connection);

  await assertTopology(channel, {
    retryDelayMs: options.retryDelayMs,
  });

  await channel.prefetch(options.prefetch ?? 1);

  await channel.consume(DEFAULT_EXPORT_QUEUE_TOPOLOGY.renderQueue, async (delivery) => {
    if (!delivery) {
      return;
    }

    let parsedMessage: ExportRenderMessage;
    const retryCount = getRetryCount(delivery);

    try {
      parsedMessage = parseExportRenderMessage(delivery);
    } catch {
      channel.nack(delivery, false, false);
      return;
    }

    try {
      const result = await options.onMessage({
        message: parsedMessage,
        retryCount,
      });

      if (result.action === "ack") {
        channel.ack(delivery);
        return;
      }

      if (result.action === "retry") {
        await publishRetryExportJob(channel, parsedMessage, {
          retryCount: result.retryCount ?? retryCount + 1,
        });
        channel.ack(delivery);
        return;
      }

      await publishDeadExportJob(channel, parsedMessage, {
        retryCount: result.retryCount ?? retryCount,
      });
      channel.ack(delivery);
    } catch {
      channel.nack(delivery, false, true);
    }
  });

  return channel;
}
