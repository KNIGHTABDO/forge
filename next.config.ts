import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable noisy fetch logs (specifically those 404s checking GitHub file existence)
  logging: false,
  async headers() {
    return [
      {
        source: '/build',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com https://*.codesandbox.io https://*.csb.app",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.codesandbox.io https://lh3.googleusercontent.com",
              "frame-src 'self' blob: https://*.codesandbox.io https://*.csb.app",
              "connect-src 'self' wss://*.codesandbox.io wss://*.csb.app https://*.codesandbox.io https://*.csb.app https://registry.npmjs.org",
            ].join('; '),
          },
        ],
      },
      {
        source: '/t/:slug*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
