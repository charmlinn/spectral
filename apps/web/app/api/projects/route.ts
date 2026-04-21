import { createProjectSchema } from "@/src/server/schemas/project";
import { createProject } from "@/src/server/services";
import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";

export { runtime };

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
