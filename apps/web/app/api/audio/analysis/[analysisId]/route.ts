import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { getAudioAnalysis } from "@/src/server/services";

export { runtime };

type AudioAnalysisRouteProps = {
  params: Promise<{
    analysisId: string;
  }>;
};

export async function GET(_: Request, { params }: AudioAnalysisRouteProps) {
  try {
    const { analysisId } = await params;
    const analysis = await getAudioAnalysis(analysisId);

    return jsonResponse(analysis);
  } catch (error) {
    return handleRouteError(error);
  }
}
