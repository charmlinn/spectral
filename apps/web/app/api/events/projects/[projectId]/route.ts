import type { NextRequest } from "next/server";

import { createEventStreamResponse } from "@/src/server/services";
import { handleRouteError } from "@/src/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectEventsRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: ProjectEventsRouteProps) {
  try {
    const { projectId } = await params;

    return createEventStreamResponse(request, {
      type: "project",
      projectId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
