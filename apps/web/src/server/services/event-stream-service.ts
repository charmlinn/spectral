import type { NextRequest } from "next/server";

import { getServerEnv } from "../env";
import { badRequest } from "../errors";
import { getServerRepositories } from "../repositories";

type EventStreamScope =
  | {
      type: "project";
      projectId: string;
    }
  | {
      type: "export";
      exportJobId: string;
    };

type SerializedEvent = {
  id: string;
  jobId: string;
  projectId: string | null;
  level: string;
  type: string;
  message: string | null;
  progress: number | null;
  payload: unknown;
  createdAt: string;
};

function parseCursor(request: NextRequest): bigint {
  const url = new URL(request.url);
  const fromSearch = url.searchParams.get("lastEventId");
  const fromHeader = request.headers.get("last-event-id");
  const rawValue = fromSearch ?? fromHeader ?? "0";

  if (!/^\d+$/.test(rawValue)) {
    throw badRequest("lastEventId must be an unsigned integer.");
  }

  return BigInt(rawValue);
}

function serializeEvent(event: {
  id: bigint;
  jobId: string;
  projectId: string | null;
  level: string;
  type: string;
  message: string | null;
  progress: number | null;
  payload: unknown;
  createdAt: Date;
}): SerializedEvent {
  return {
    id: event.id.toString(),
    jobId: event.jobId,
    projectId: event.projectId,
    level: event.level,
    type: event.type,
    message: event.message,
    progress: event.progress,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

async function readEvents(scope: EventStreamScope, cursor: bigint) {
  const { prisma } = getServerRepositories();

  if (scope.type === "project") {
    return prisma.exportJobEvent.findMany({
      where: {
        projectId: scope.projectId,
        id: {
          gt: cursor,
        },
      },
      orderBy: {
        id: "asc",
      },
      take: 100,
    });
  }

  return prisma.exportJobEvent.findMany({
    where: {
      jobId: scope.exportJobId,
      id: {
        gt: cursor,
      },
    },
    orderBy: {
      id: "asc",
    },
    take: 100,
  });
}

export function createEventStreamResponse(request: NextRequest, scope: EventStreamScope) {
  const env = getServerEnv();
  const encoder = new TextEncoder();
  const initialCursor = parseCursor(request);

  return new Response(
    new ReadableStream({
      start(controller) {
        let cursor = initialCursor;
        let closed = false;
        let polling = false;

        const flushEvents = async () => {
          if (closed || polling) {
            return;
          }

          polling = true;

          try {
            const events = await readEvents(scope, cursor);

            for (const event of events) {
              const serialized = serializeEvent(event);
              cursor = BigInt(serialized.id);
              controller.enqueue(
                encoder.encode(
                  `id: ${serialized.id}\nevent: ${serialized.type}\ndata: ${JSON.stringify(serialized)}\n\n`,
                ),
              );
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to poll events.";
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
            );
          } finally {
            polling = false;
          }
        };

        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        void flushEvents();

        const pollTimer = setInterval(() => {
          void flushEvents();
        }, env.ssePollIntervalMs);

        const heartbeatTimer = setInterval(() => {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, env.sseHeartbeatIntervalMs);

        const abortHandler = () => {
          closed = true;
          clearInterval(pollTimer);
          clearInterval(heartbeatTimer);
          controller.close();
        };

        request.signal.addEventListener("abort", abortHandler);
      },
      cancel() {
        return undefined;
      },
    }),
    {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    },
  );
}
