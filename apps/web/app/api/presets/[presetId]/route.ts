import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { getPreset } from "@/src/server/services";

export { runtime };

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
