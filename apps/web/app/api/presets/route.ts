import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { listPresets } from "@/src/server/services";

export async function GET() {
  try {
    const presets = await listPresets();
    return jsonResponse(presets);
  } catch (error) {
    return handleRouteError(error);
  }
}
