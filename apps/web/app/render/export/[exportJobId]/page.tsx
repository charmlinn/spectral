import type { Metadata } from "next";

import { serializeForJson } from "@/src/server/http";
import { getRenderPayload } from "@/src/server/services";

type RenderExportPageProps = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function generateMetadata({
  params,
}: RenderExportPageProps): Promise<Metadata> {
  const { exportJobId } = await params;

  return {
    title: `Render ${exportJobId} | Spectral`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function RenderExportPage({ params }: RenderExportPageProps) {
  const { exportJobId } = await params;
  const payload = await getRenderPayload(exportJobId);
  const serializedPayload = serializeForJson(payload);
  const bootstrapUrl = payload.routes.bootstrapPath;

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
            Internal Render Surface
          </p>
          <h1 className="font-heading text-3xl font-semibold">
            Export job {payload.exportJob.id}
          </h1>
          <p className="max-w-3xl text-sm text-neutral-400">
            This page is intended for the render worker and Playwright-driven Chromium
            sessions. It exposes a deterministic bootstrap contract that codex2 runtime
            code can consume through <code className="mx-1 rounded bg-black/40 px-1 py-0.5">{bootstrapUrl}</code>.
          </p>
        </header>

        <section className="grid gap-4 rounded-3xl border border-neutral-800 bg-neutral-900/80 p-6 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Status</p>
            <p className="mt-2 text-lg font-medium">{payload.exportJob.status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Format</p>
            <p className="mt-2 text-lg font-medium">{payload.exportJob.format}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Surface</p>
            <p className="mt-2 text-lg font-medium">
              {payload.exportJob.width}x{payload.exportJob.height}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">FPS</p>
            <p className="mt-2 text-lg font-medium">{payload.exportJob.fps}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-6">
          <h2 className="font-heading text-xl font-semibold">Render mount target</h2>
          <p className="mt-2 text-sm text-neutral-400">
            The shared browser runtime should mount into the target below and use the
            embedded bootstrap JSON or the bootstrap route for deterministic rendering.
          </p>
          <div
            id={payload.runtime.targetElementId}
            data-bootstrap-url={bootstrapUrl}
            data-export-job-id={payload.exportJob.id}
            className="mt-4 aspect-video w-full rounded-2xl border border-dashed border-cyan-400/40 bg-black/30"
          />
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-6">
          <h2 className="font-heading text-xl font-semibold">Bootstrap payload</h2>
          <p className="mt-2 text-sm text-neutral-400">
            The payload below is also embedded in a script tag with the id
            <code className="mx-1 rounded bg-black/40 px-1 py-0.5">spectral-render-page-bootstrap</code>.
          </p>
          <script
            id="spectral-render-page-bootstrap"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(serializedPayload),
            }}
          />
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs text-neutral-200">
            {JSON.stringify(serializedPayload, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
