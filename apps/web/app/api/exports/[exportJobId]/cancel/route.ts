import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { cancelExportJob } from "@/src/server/services";

type CancelExportRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function POST(_: Request, { params }: CancelExportRouteProps) {
  try {
    const { exportJobId } = await params;
    const job = await cancelExportJob(exportJobId);

    return jsonResponse(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
