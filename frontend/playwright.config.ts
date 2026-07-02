import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    headless: true,
  },
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'cd ../backend && node dist/src/main.js & NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1 npx next dev -p 3000',
        url: 'http://localhost:3000/login',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
