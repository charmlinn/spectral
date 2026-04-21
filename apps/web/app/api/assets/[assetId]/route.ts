import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { getAsset } from "@/src/server/services";

type AssetRouteProps = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(_: Request, { params }: AssetRouteProps) {
  try {
    const { assetId } = await params;
    const asset = await getAsset(assetId);

    return jsonResponse(asset);
  } catch (error) {
    return handleRouteError(error);
  }
}
