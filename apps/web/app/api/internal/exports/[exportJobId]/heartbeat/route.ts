import { handleRouteError, jsonResponse } from "@/src/server/http";
import { internalExportHeartbeatSchema } from "@/src/server/schemas/export";
import {
  assertInternalExportRequest,
  recordExportHeartbeat,
} from "@/src/server/services";

export const runtime = "nodejs";

type InternalExportHeartbeatRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function POST(request: Request, { params }: InternalExportHeartbeatRouteProps) {
  try {
    assertInternalExportRequest(request);

    const { exportJobId } = await params;
    const body = internalExportHeartbeatSchema.parse(await request.json());
    const job = await recordExportHeartbeat(exportJobId, body);

    return jsonResponse(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
