import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { createExportJobSchema } from "@/src/server/schemas/export";
import { createExportJob } from "@/src/server/services";

export { runtime };

export async function POST(request: Request) {
  try {
    const body = createExportJobSchema.parse(await request.json());
    const result = await createExportJob(body);

    return jsonResponse(result, {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
