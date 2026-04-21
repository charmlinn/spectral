import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { createExportJobSchema } from "@/src/server/schemas/export";
import { createExportJob } from "@/src/server/services";

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
