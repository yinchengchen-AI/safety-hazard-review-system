import { test, expect } from '@playwright/test';

test('reject then resubmit', async ({ page }) => {
  // 1. Inspector logs in, creates a case, submits a review
  await page.goto('/login');
  await page.fill('input[type=email]', 'inspector@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await page.goto('/cases/new');
  await page.locator('text=选择企业').click();
  await page.locator('[role=option]').first().click();
  await page.locator('text=隐患类型').click();
  await page.locator('[role=option]').first().click();
  await page.fill('[name=source]', 'reject test');
  await page.fill('[name=description]', 'reject description');
  await page.fill('[name=address]', 'reject address');
  await page.fill('[name=deadline]', '2026-12-31');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/cases\/[a-z0-9]+$/);

  await page.click('text=开始复核');
  await page.locator('input[value=PASS]').first().click();
  await page.fill('textarea', 'first review');
  await page.click('text=提交复核');

  // 2. Switch to chief and reject
  await page.goto('/login');
  await page.click('text=登出');
  await page.fill('input[type=email]', 'chief@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await page.goto('/cases');
  await page.locator('text=审核').first().click();
  await page.click('text=领取审核');
  await page.fill('input[placeholder*="驳回理由"]', 'rejected for E2E');
  await page.click('button:has-text("驳回")');

  // 3. Switch back to inspector, restart review
  await page.goto('/login');
  await page.click('text=登出');
  await page.fill('input[type=email]', 'inspector@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await page.locator('text=开始复核').first().click();
  await page.locator('input[value=PASS]').first().click();
  await page.fill('textarea', 'resubmit review');
  await page.click('text=提交复核');
  await expect(page).toHaveURL(/\/cases\/[a-z0-9]+$/);
});
