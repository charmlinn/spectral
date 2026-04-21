import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { updateProjectSchema } from "@/src/server/schemas/project";
import { getProject, updateProject } from "@/src/server/services";

export { runtime };

type ProjectRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_: Request, { params }: ProjectRouteProps) {
  try {
    const { projectId } = await params;
    const project = await getProject(projectId);

    return jsonResponse(project);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: ProjectRouteProps) {
  try {
    const { projectId } = await params;
    const body = updateProjectSchema.parse(await request.json());
    const project = await updateProject(projectId, body);

    return jsonResponse(project);
  } catch (error) {
    return handleRouteError(error);
  }
}
