import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { listProjectExports } from "@/src/server/services";

type ProjectExportsRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_: Request, { params }: ProjectExportsRouteProps) {
  try {
    const { projectId } = await params;
    const exports = await listProjectExports(projectId);

    return jsonResponse(exports);
  } catch (error) {
    return handleRouteError(error);
  }
}
