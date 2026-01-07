import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 允许 Server Actions 接收最高 10MB 的数据
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;