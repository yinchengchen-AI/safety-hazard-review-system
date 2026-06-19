import { test, expect } from '@playwright/test';

test('full happy path: register -> review -> audit -> close', async ({ page }) => {
  // 1. inspector logs in and registers a case
  await page.goto('/login');
  await page.fill('input[type=email]', 'inspector@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/');
  await page.goto('/cases/new');
  await page.locator('text=请选择企业').click();
  await page.locator('[role=option]').first().click();
  await page.locator('text=请选择隐患类型').click();
  await page.locator('[role=option]').first().click();
  await page.fill('[name=source]', 'E2E test');
  await page.fill('[name=description]', 'E2E description');
  await page.fill('[name=address]', 'E2E address');
  await page.fill('[name=deadline]', '2026-12-31');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/cases\/[a-z0-9]+$/);

  // 2. start review
  await page.click('text=开始复核');
  // first radio (PASS) for first checklist item
  await page.locator('input[value=PASS]').first().click();
  await page.fill('textarea', 'E2E review summary');
  // submit
  await page.click('text=提交复核');
  await expect(page).toHaveURL(/\/cases\/[a-z0-9]+$/);

  // 3. chief logs in
  await page.goto('/login');
  await page.click('text=登出');
  await page.fill('input[type=email]', 'chief@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/');
  await page.goto('/cases');
  await page.locator('table tbody tr a').first().click();
  await page.click('text=审核');
  await page.click('text=领取审核');
  await page.click('text=通过 + 签字');
  await expect(page).toHaveURL(/\/cases\/[a-z0-9]+$/);
  await expect(page.locator('text=已销案')).toBeVisible();
});
