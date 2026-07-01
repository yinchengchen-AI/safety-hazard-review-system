import { test, expect } from '@playwright/test'

test('login + dashboard renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('text=安全生产隐患复核系统')).toBeVisible()
  await page.fill('input[placeholder="用户名"]', 'admin')
  await page.fill('input[placeholder="密码"]', 'admin123')
  await page.click('button:has-text("登 录")')
  await page.waitForURL('**/', { timeout: 10_000 })
  await expect(page.locator('text=隐患总数')).toBeVisible({ timeout: 10_000 })
})

test('hazards list page loads', async ({ page }) => {
  // Login first
  await page.goto('/login')
  await page.fill('input[placeholder="用户名"]', 'admin')
  await page.fill('input[placeholder="密码"]', 'admin123')
  await page.click('button:has-text("登 录")')
  await page.waitForURL('**/', { timeout: 10_000 })

  await page.goto('/hazards')
  await expect(page.locator('text=编号').first()).toBeVisible({ timeout: 10_000 })
})
