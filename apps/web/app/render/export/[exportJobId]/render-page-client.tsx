"use client";

import { useEffect } from "react";

import { createSpectralRendererDriver } from "@spectral/render-runtime-browser";

type RenderPageClientProps = {
  targetElementId: string;
};

export function RenderPageClient({ targetElementId }: RenderPageClientProps) {
  useEffect(() => {
    const target = document.getElementById(targetElementId);

    if (!(target instanceof HTMLElement)) {
      throw new Error(`Render page target #${targetElementId} is not available.`);
    }

    const driver = createSpectralRendererDriver({
      target,
    });

    window.__spectralRenderDriver = driver;

    return () => {
      void driver.dispose();

      if (window.__spectralRenderDriver === driver) {
        delete window.__spectralRenderDriver;
      }
    };
  }, [targetElementId]);

  return null;
}
