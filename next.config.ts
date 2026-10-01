/**
 * @file next.config.ts
 * @description Next.js 16 App Router configuration.
 * Configures server runtime, external package bundling, and standalone container output.
 * @phase Phase 1: Project Scaffold & Phase 12: Production Polish
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone server bundle for containerization when not on Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node',
    'sharp',
    'pg',
  ],
};

export default nextConfig;
