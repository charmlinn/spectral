import { NonRetryableWorkerError } from "./errors";

export type RenderExecutionResult = {
  outputStorageKey?: string | null;
  posterStorageKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type RenderExecutor = {
  execute(input: {
    exportJobId: string;
    renderPageUrl: string;
  }): Promise<RenderExecutionResult>;
};

export class UnimplementedRenderExecutor implements RenderExecutor {
  async execute(input: {
    exportJobId: string;
    renderPageUrl: string;
  }): Promise<RenderExecutionResult> {
    throw new NonRetryableWorkerError(
      `Render executor is not implemented for export job ${input.exportJobId}. Expected Chromium + render-runtime-browser integration at ${input.renderPageUrl}.`,
      "RENDER_NOT_IMPLEMENTED",
    );
  }
}
