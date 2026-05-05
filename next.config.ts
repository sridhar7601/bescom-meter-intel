import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React Strict Mode to avoid Leaflet "Map container is already
  // initialized" error caused by intentional double-mount in dev.
  reactStrictMode: false,
};

export default nextConfig;
