import { expect, test } from '@playwright/test';

test('status page shows the API and database as healthy', async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'Construction ERP' })).toBeVisible();
  await expect(page.getByText('Running', { exact: true })).toBeVisible();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
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
  // Signed out: sign in first (the app does not reveal which addresses exist).
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue as demo user' }).click();
  // Signed in: a friendly not-found page.
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
