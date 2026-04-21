import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { saveProjectSnapshotSchema } from "@/src/server/schemas/project";
import { saveProjectSnapshot } from "@/src/server/services";

type SaveProjectRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, { params }: SaveProjectRouteProps) {
  try {
    const { projectId } = await params;
    const body = saveProjectSnapshotSchema.parse(await request.json());
    const result = await saveProjectSnapshot(projectId, body);

    return jsonResponse(result, {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
