import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd() + '/..',
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
