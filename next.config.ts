import type { NextConfig } from "next";
import path from "node:path";
import webpack from "webpack";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["postgres", "node:sqlite"],
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.103"],
  webpack(config) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, path.resolve(process.cwd(), "lib/runtime-env.ts")));
    return config;
  },
};

export default nextConfig;
