import { test, expect } from './fixtures/auth'

test('login + dashboard renders', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.locator('text=隐患总数')).toBeVisible({ timeout: 10_000 })
})

test('hazards list page loads', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/hazards')
  await expect(authenticatedPage.locator('text=编号').first()).toBeVisible({ timeout: 10_000 })
})
