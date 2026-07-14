import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: process.env.CI ? 'on-first-retry' : 'on',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : [
        {
          command: 'cd ../backend && npm run start:prod',
          url: `${apiBase.replace(/\/api\/v1$/, '')}/api/v1/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `NEXT_PUBLIC_API_BASE=${apiBase} npx next dev -p 3000`,
          url: 'http://localhost:3000/login',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
})
