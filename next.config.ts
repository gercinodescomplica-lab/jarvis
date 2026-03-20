import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

// dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {},
  transpilePackages: ['@jarvis/core', '@jarvis/adapters'],
  serverExternalPackages: ['pdf-parse'],
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/data/**', '**/*.json', '**/*.log'],
      }
    }
    return config
  },
};

export default nextConfig;
