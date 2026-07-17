/** @type {import('next').NextConfig} */
// P1-11: fail fast at build time if SECRET_KEY is missing in
// staging/production. The Edge middleware (apps/frontend/src/middleware.ts)
// needs it to verify JWTs without round-tripping to the API.
const env = process.env.ENV || 'dev';
const secret = process.env.SECRET_KEY;
if ((env === 'production' || env === 'staging') && (!secret || secret.length < 32)) {
  throw new Error(
    `SECRET_KEY must be set to a 32+ char string in ${env} (frontend Edge middleware needs it).`,
  );
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/charts', 'rc-util', 'rc-pagination', 'rc-picker'],
  output: 'standalone',
  // Surface SECRET_KEY to the server runtime only — it is NOT
  // prefixed NEXT_PUBLIC_, so client bundles won't include it.
  serverRuntimeConfig: {
    secretKey: secret ?? '',
  },
  env: {
    // NEXT_PUBLIC_API_BASE is the only env var the browser bundle
    // should see. SECRET_KEY must never appear here.
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || '/api/v1',
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' http://localhost:8000 http://localhost:9000",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
};
module.exports = nextConfig;
