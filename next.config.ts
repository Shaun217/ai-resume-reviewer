/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // ⭐ 必须添加这一行，将限制提升到 10MB
      bodySizeLimit: '10mb', 
    },
  },
};

export default nextConfig;