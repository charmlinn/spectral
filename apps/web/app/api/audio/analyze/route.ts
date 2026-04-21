import { handleRouteError, jsonResponse } from "@/src/server/http";
import { runtime } from "@/src/server/node-runtime";
import { requestAudioAnalysisSchema } from "@/src/server/schemas/audio";
import { requestAudioAnalysis } from "@/src/server/services";

export { runtime };

export async function POST(request: Request) {
  try {
    const body = requestAudioAnalysisSchema.parse(await request.json());
    const result = await requestAudioAnalysis(body);

    return jsonResponse(result, {
      status: 202,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
