import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { getExportJob } from "@/src/server/services";

export { runtime };

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
