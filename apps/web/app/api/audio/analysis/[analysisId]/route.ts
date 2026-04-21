import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { getAudioAnalysis } from "@/src/server/services";

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
