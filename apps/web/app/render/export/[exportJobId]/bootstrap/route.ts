import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { getRenderPageBootstrap } from "@/src/server/services";

export { runtime };
export const dynamic = "force-dynamic";

type RenderBootstrapRouteProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function GET(_: Request, { params }: RenderBootstrapRouteProps) {
  try {
    const { exportJobId } = await params;
    const payload = await getRenderPageBootstrap(exportJobId);

    return jsonResponse(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
