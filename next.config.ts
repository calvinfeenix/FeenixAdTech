import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` produces a self-contained server bundle for lean container
  // images on Railway (only the files the server actually needs are copied).
  output: "standalone",
  devIndicators: false,
  // `sharp` is a native module; keep it external so it is required at runtime
  // from node_modules rather than bundled by the server compiler.
  serverExternalPackages: ["sharp"],
  images: {
    // Asset thumbnails are served from Supabase Storage. Allow any https host
    // so a Supabase project URL from env works without a code change.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Keep the client-side Router Cache warm so returning to an already-visited
    // page (dashboard/campaign) is instant instead of re-fetching from scratch.
    staleTimes: { dynamic: 60, static: 180 },
  },
};

export default nextConfig;
