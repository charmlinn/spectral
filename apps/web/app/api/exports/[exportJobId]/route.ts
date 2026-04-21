import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { getExportJob } from "@/src/server/services";

type ExportRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function GET(_: Request, { params }: ExportRouteProps) {
  try {
    const { exportJobId } = await params;
    const job = await getExportJob(exportJobId);

    return jsonResponse(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
