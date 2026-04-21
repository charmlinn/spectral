import { handleRouteError, jsonResponse } from "@/src/server/http";
export const runtime = "nodejs";
import { requestAudioAnalysisSchema } from "@/src/server/schemas/audio";
import { requestAudioAnalysis } from "@/src/server/services";

export async function POST(request: Request) {
  try {
    const body = requestAudioAnalysisSchema.parse(await request.json()) as Parameters<
      typeof requestAudioAnalysis
    >[0];
    const result = await requestAudioAnalysis(body);

    return jsonResponse(result, {
      status: 202,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
