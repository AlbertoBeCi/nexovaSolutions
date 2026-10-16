import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack(config, { dev }) {
    if (dev && process.env.NEXT_DOCKER_POLLING === "1") {
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 300,
        poll: 1000,
      };
    }

    return config;
  },
};

export default nextConfig;
