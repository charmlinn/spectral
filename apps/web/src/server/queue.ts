import {
  assertTopology,
  closeAmqpResources,
  createConfirmChannel,
  createConnection,
  publishExportJob,
  type ExportRenderMessage,
} from "@spectral/queue";

import { getServerEnv } from "./env";

export async function publishExportRenderMessage(message: ExportRenderMessage): Promise<void> {
  const env = getServerEnv();
  const connection = await createConnection(env.amqpUrl);
  const channel = await createConfirmChannel(connection);

  try {
    await assertTopology(channel, {
      retryDelayMs: env.amqpRetryDelayMs,
    });
    await publishExportJob(channel, message);
  } finally {
    await closeAmqpResources({
      channel,
      connection,
    });
  }
}
