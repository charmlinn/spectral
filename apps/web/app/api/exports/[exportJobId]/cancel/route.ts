import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { cancelExportJob } from "@/src/server/services";

export { runtime };

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
