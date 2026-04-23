import { handleRouteError, jsonResponse } from "@/src/server/http";
import { internalExportFinalizeSchema } from "@/src/server/schemas/export";
import {
  assertInternalExportRequest,
  finalizeExportJob,
} from "@/src/server/services";

export const runtime = "nodejs";

type InternalExportFinalizeRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function POST(request: Request, { params }: InternalExportFinalizeRouteProps) {
  try {
    assertInternalExportRequest(request);

    const { exportJobId } = await params;
    const body = internalExportFinalizeSchema.parse(await request.json());
    const job = await finalizeExportJob(exportJobId, body);

    return jsonResponse(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
