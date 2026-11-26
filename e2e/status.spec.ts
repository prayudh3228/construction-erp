import { expect, test } from '@playwright/test';

test('web app shows the API and database as healthy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Construction ERP' })).toBeVisible();
  await expect(page.getByText('Running')).toBeVisible();
  await expect(page.getByText('Connected')).toBeVisible();
  // Date is shown as DD-MM-YYYY
  await expect(page.getByText(/^\d{2}-\d{2}-\d{4}$/)).toBeVisible();
});

test('API health is reachable through the web server', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: 'ok', checks: { database: 'up' } });
});

test('unknown routes fall back to the app, not a server error', async ({ page }) => {
  const res = await page.goto('/some/deep/link');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Construction ERP' })).toBeVisible();
});
