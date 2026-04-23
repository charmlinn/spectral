import { handleRouteError, jsonResponse } from "@/src/server/http";
import { internalExportStageSchema } from "@/src/server/schemas/export";
import {
  assertInternalExportRequest,
  updateExportJobStage,
} from "@/src/server/services";

export const runtime = "nodejs";

type InternalExportStageRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function POST(request: Request, { params }: InternalExportStageRouteProps) {
  try {
    assertInternalExportRequest(request);

    const { exportJobId } = await params;
    const body = internalExportStageSchema.parse(await request.json());
    const job = await updateExportJobStage(exportJobId, body);

    return jsonResponse(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
