import { createProjectSchema } from "@/src/server/schemas/project";
import { createProject, listProjects } from "@/src/server/services";
import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";

export async function GET() {
  try {
    return jsonResponse(await listProjects());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createProjectSchema.parse(await request.json());
    const project = await createProject(body);

    return jsonResponse(project, {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
