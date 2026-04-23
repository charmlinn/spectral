"use client";

import { useEffect } from "react";

import {
  createSpectralRendererDriver,
  type RenderPageBootstrapPayload,
} from "@spectral/render-runtime-browser";

type RenderPageClientProps = {
  payload: RenderPageBootstrapPayload;
};

export function RenderPageClient({ payload }: RenderPageClientProps) {
  useEffect(() => {
    const target = document.getElementById(payload.runtime.targetElementId);

    if (!(target instanceof HTMLElement)) {
      throw new Error(
        `Render page target #${payload.runtime.targetElementId} is not available.`,
      );
    }

    const driver = createSpectralRendererDriver({
      target,
      bootstrap: payload,
    });

    window.__spectralRenderDriver = driver;

    void driver
      .init({
        session: payload.session,
        bootstrap: payload,
      })
      .catch((error: unknown) => {
        console.error("Failed to initialize render page driver.", error);
      });

    return () => {
      void driver.dispose();

      if (window.__spectralRenderDriver === driver) {
        delete window.__spectralRenderDriver;
      }
    };
  }, [payload]);

  return null;
}
