import { createAssetUploadUrlSchema } from "@/src/server/schemas/asset";
import { createAssetUploadUrl } from "@/src/server/services";
import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";

export { runtime };

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
