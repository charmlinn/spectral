import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type ExportJobSummary = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  updatedAt: string;
};

export type ExportEventRecord = {
  id: string;
  jobId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type ExportStoreState = {
  jobs: ExportJobSummary[];
  currentJobId: string | null;
  sseConnectionState: "idle" | "connecting" | "open" | "closed" | "error";
  eventsByJobId: Record<string, ExportEventRecord[]>;
  setJobs(jobs: ExportJobSummary[]): void;
  upsertJob(job: ExportJobSummary): void;
  setCurrentJobId(currentJobId: string | null): void;
  setSseConnectionState(
    sseConnectionState: ExportStoreState["sseConnectionState"],
  ): void;
  appendEvent(event: ExportEventRecord): void;
  clearEvents(jobId?: string): void;
};

export const useExportStore = create<ExportStoreState>()(
  subscribeWithSelector((set) => ({
    jobs: [],
    currentJobId: null,
    sseConnectionState: "idle",
    eventsByJobId: {},
    setJobs(jobs) {
      set({ jobs });
    },
    upsertJob(job) {
      set((state) => {
        const existingIndex = state.jobs.findIndex((item) => item.id === job.id);
        if (existingIndex < 0) {
          return { jobs: [...state.jobs, job] };
        }

        const jobs = [...state.jobs];
        jobs[existingIndex] = job;
        return { jobs };
      });
    },
    setCurrentJobId(currentJobId) {
      set({ currentJobId });
    },
    setSseConnectionState(sseConnectionState) {
      set({ sseConnectionState });
    },
    appendEvent(event) {
      set((state) => ({
        eventsByJobId: {
          ...state.eventsByJobId,
          [event.jobId]: [...(state.eventsByJobId[event.jobId] ?? []), event],
        },
      }));
    },
    clearEvents(jobId) {
      set((state) => {
        if (!jobId) {
          return { eventsByJobId: {} };
        }

        const nextEvents = { ...state.eventsByJobId };
        delete nextEvents[jobId];
        return { eventsByJobId: nextEvents };
      });
    },
  })),
);
