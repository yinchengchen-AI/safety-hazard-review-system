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

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd() + '/..',
  // instrumentationHook was promoted out of experimental in Next 15
  // @ts-expect-error - accepted at runtime; the TS type lags behind.
  experimental: { instrumentationHook: true },
};

export default withPwa(nextConfig);
