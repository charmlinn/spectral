import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@spectral/db",
    "@spectral/media",
    "@spectral/project-schema",
    "@spectral/queue",
    "@spectral/render-runtime-browser",
    "@spectral/ui",
  ],
};

export default nextConfig;
