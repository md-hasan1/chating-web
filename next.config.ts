import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['[::1]', 'localhost'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
