export const EXPORT_RENDER_QUEUE_NAME = "export-render";
export const EXPORT_RENDER_JOB_NAME = "export-render";

export const exportDispatchClassValues = [
  "cpu-standard",
  "gpu-standard",
  "gpu-heavy",
  "high-memory",
] as const;

export const DEFAULT_EXPORT_DISPATCH_CLASS = "gpu-standard";
export const DEFAULT_EXPORT_JOB_PRIORITY = 50;

export type ExportDispatchClass = (typeof exportDispatchClassValues)[number];

export type ExportRenderJobData = {
  exportJobId: string;
  requestedAt: string;
  dispatchClass: ExportDispatchClass;
  priority: number;
  requestedAttempt: number;
};
