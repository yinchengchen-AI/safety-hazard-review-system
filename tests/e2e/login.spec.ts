import { test, expect } from '@playwright/test';

test('inspector can log in', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type=email]', 'inspector@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1')).toContainText('工作台');
});
