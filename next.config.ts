import type { NextConfig } from 'next';
import withPwaInit from '@ducanh2912/next-pwa';

const withPwa = withPwaInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.destination === 'image',
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
});

// `instrumentation.ts` is auto-detected in Next.js 15, no experimental flag needed.
const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd() + '/..',
};

export default withPwa(nextConfig);
