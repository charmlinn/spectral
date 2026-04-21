import type { ConfirmChannel } from "amqplib";

import { DEFAULT_EXPORT_QUEUE_TOPOLOGY, type AssertTopologyOptions } from "./types";

export async function assertTopology(
  channel: ConfirmChannel,
  options: AssertTopologyOptions = {},
) {
  const topology = DEFAULT_EXPORT_QUEUE_TOPOLOGY;
  const durable = options.durable ?? true;

  await channel.assertExchange(topology.exchange, topology.exchangeType, {
    durable,
  });

  await channel.assertQueue(topology.renderQueue, {
    durable,
    deadLetterExchange: topology.exchange,
    deadLetterRoutingKey: topology.deadRoutingKey,
  });
  await channel.bindQueue(topology.renderQueue, topology.exchange, topology.requestRoutingKey);

  await channel.assertQueue(topology.retryQueue, {
    durable,
    deadLetterExchange: topology.exchange,
    deadLetterRoutingKey: topology.requestRoutingKey,
    messageTtl: options.retryDelayMs ?? 30_000,
  });
  await channel.bindQueue(topology.retryQueue, topology.exchange, topology.retryRoutingKey);

  await channel.assertQueue(topology.deadQueue, {
    durable,
  });
  await channel.bindQueue(topology.deadQueue, topology.exchange, topology.deadRoutingKey);

  return topology;
}
