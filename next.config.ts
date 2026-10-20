import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The Docker build puts a self-contained server into .next/standalone and the image runs it.
  // Only there: with it, a local `next start` warns that it should not be used.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
