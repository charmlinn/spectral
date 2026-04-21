import { createAssetUploadUrlSchema } from "@/src/server/schemas/asset";
import { createAssetUploadUrl } from "@/src/server/services";
import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = createAssetUploadUrlSchema.parse(await request.json());
    const result = await createAssetUploadUrl(body);

    return jsonResponse(result, {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
