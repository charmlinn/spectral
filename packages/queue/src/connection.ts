import IORedis from "ioredis";

export type QueueRedisConnection = IORedis;

type Closable = {
  close: () => Promise<void>;
};

export function createQueueConnection(redisUrl: string): QueueRedisConnection {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

async function closeClosable(resource?: Closable | null) {
  if (!resource) {
    return;
  }

  await resource.close();
}

async function closeConnection(connection?: QueueRedisConnection | null) {
  if (!connection) {
    return;
  }

  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
}

export async function closeQueueResources(resources: {
  queue?: Closable | null;
  worker?: Closable | null;
  connection?: QueueRedisConnection | null;
}): Promise<void> {
  await Promise.allSettled([
    closeClosable(resources.queue),
    closeClosable(resources.worker),
    closeConnection(resources.connection),
  ]);
}
