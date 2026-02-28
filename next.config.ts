import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/faq',
        destination: '/idaho-legislative-process',
        permanent: true, // 301 redirect — preserves SEO equity
      },
    ]
  },
};

export default nextConfig;
