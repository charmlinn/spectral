import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { getPreset } from "@/src/server/services";

type PresetRouteProps = {
  params: Promise<{
    presetId: string;
  }>;
};

export async function GET(_: Request, { params }: PresetRouteProps) {
  try {
    const { presetId } = await params;
    const preset = await getPreset(presetId);

    return jsonResponse(preset);
  } catch (error) {
    return handleRouteError(error);
  }
}
