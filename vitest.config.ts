import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Coverage is measured on the unit-testable core: services + lib + workers.
// src/app/**       — API routes, covered by E2E (tests/e2e/ via Playwright).
// src/pwa/**       — client offline layer, covered by E2E + manual smoke.
// src/components/** — presentation components, covered by E2E + manual smoke.
// src/hooks/**     — UI hooks, covered by E2E + manual smoke.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['tests/unit/**', 'tests/integration/**'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**', '**/.gitkeep'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/services/**/*.ts',
        'src/lib/**/*.ts',
        'src/workers/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 25, functions: 23, branches: 17, statements: 25 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
