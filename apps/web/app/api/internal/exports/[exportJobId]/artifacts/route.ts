import { handleRouteError, jsonResponse } from "@/src/server/http";
import { internalExportArtifactSchema } from "@/src/server/schemas/export";
import {
  assertInternalExportRequest,
  createExportArtifact,
} from "@/src/server/services";

export const runtime = "nodejs";

type InternalExportArtifactsRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function POST(request: Request, { params }: InternalExportArtifactsRouteProps) {
  try {
    assertInternalExportRequest(request);

    const { exportJobId } = await params;
    const body = internalExportArtifactSchema.parse(await request.json());
    const result = await createExportArtifact(exportJobId, body);

    return jsonResponse(result, {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
