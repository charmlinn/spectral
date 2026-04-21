import { completeAssetSchema } from "@/src/server/schemas/asset";
import { completeAsset } from "@/src/server/services";
import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";

export { runtime };

export async function POST(request: Request) {
  try {
    const body = completeAssetSchema.parse(await request.json());
    const asset = await completeAsset(body);

    return jsonResponse(asset);
  } catch (error) {
    return handleRouteError(error);
  }
}
