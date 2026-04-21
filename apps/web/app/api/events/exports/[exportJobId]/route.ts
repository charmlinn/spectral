import type { NextRequest } from "next/server";

import { createEventStreamResponse } from "@/src/server/services";
import { handleRouteError } from "@/src/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportEventsRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: ExportEventsRouteProps) {
  try {
    const { exportJobId } = await params;

    return createEventStreamResponse(request, {
      type: "export",
      exportJobId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
