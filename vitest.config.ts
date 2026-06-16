import { defineConfig } from 'vitest/config';
import path from 'path';

// Coverage is measured on services + lib + workers (the unit-testable core).
// src/app/** (API routes) is covered by E2E tests (tests/e2e/ via Playwright).
// src/pwa/** (client-side) is covered by E2E + manual smoke tests.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['tests/unit/**', 'tests/integration/**'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/**', 'src/pwa/**', 'src/**/instrumentation.ts', 'src/middleware.ts'],
      thresholds: { lines: 25, functions: 25, branches: 15, statements: 25 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
