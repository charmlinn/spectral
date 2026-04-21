import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { listPresets } from "@/src/server/services";

export { runtime };

export async function GET() {
  try {
    const presets = await listPresets();
    return jsonResponse(presets);
  } catch (error) {
    return handleRouteError(error);
  }
}
