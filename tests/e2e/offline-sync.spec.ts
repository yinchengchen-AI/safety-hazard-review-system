import { test, expect } from '@playwright/test';

test('offline review draft syncs when back online', async ({ page, context }) => {
  await page.goto('/login');
  await page.fill('input[type=email]', 'inspector@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await page.goto('/cases');
  // open the first case detail
  await page.locator('text=查看').first().click();
  await page.goto(page.url() + '/review');
  await page.click('text=开始复核');

  // go offline
  await context.setOffline(true);

  // fill checklist + summary + submit -> should enqueue
  await page.locator('input[value=PASS]').first().click();
  await page.fill('textarea', 'offline submission');
  await page.click('text=提交复核');
  await expect(page.locator('text=已离线保存')).toBeVisible();

  // back online
  await context.setOffline(false);
  await page.goto('/me/sync');
  // either the queue drained or there is nothing pending
  await expect(
    page.locator('text=没有待同步项').or(page.locator('text=暂无待同步'))
  ).toBeVisible({ timeout: 15000 });
});
