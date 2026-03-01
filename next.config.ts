import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/faq',
        destination: '/idaho-legislative-process',
        permanent: true,
      },
      {
        // /bills/2026 → /bills?year=2026 (year as path segment → query param)
        source: '/bills/:year(\\d{4})',
        destination: '/bills?year=:year',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
