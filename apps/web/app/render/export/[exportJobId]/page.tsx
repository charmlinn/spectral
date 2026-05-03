import type { Metadata } from "next";

import { RenderPageClient } from "./render-page-client";

const RENDER_PAGE_TARGET_ELEMENT_ID = "spectral-render-surface";

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

  return (
    <main className="min-h-screen bg-black">
      <div
        id={RENDER_PAGE_TARGET_ELEMENT_ID}
        data-bootstrap-url={`/render/export/${exportJobId}/bootstrap`}
        data-export-job-id={exportJobId}
        className="fixed left-0 top-0 bg-black"
      />
      <RenderPageClient targetElementId={RENDER_PAGE_TARGET_ELEMENT_ID} />
    </main>
  );
}
