import { connect } from "amqplib";
import type { ChannelModel, ConfirmChannel } from "amqplib";

export async function createConnection(amqpUrl: string): Promise<ChannelModel> {
  return connect(amqpUrl);
}

export async function createConfirmChannel(connection: ChannelModel): Promise<ConfirmChannel> {
  return connection.createConfirmChannel();
}

export async function closeAmqpResources(resources: {
  channel?: ConfirmChannel | null;
  connection?: ChannelModel | null;
}): Promise<void> {
  await resources.channel?.close().catch(() => undefined);
  await resources.connection?.close().catch(() => undefined);
}
