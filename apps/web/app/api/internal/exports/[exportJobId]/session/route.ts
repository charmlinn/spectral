import { handleRouteError, jsonResponse } from "@/src/server/http";
import { assertInternalExportRequest, getRenderSession } from "@/src/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InternalExportSessionRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function GET(request: Request, { params }: InternalExportSessionRouteProps) {
  try {
    assertInternalExportRequest(request);

    const { exportJobId } = await params;
    const session = await getRenderSession(exportJobId);

    return jsonResponse(session);
  } catch (error) {
    return handleRouteError(error);
  }
}
