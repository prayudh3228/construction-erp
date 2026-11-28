import { type Page, expect, test } from '@playwright/test';

/** The seeded FAKE demo users' password (local demo value; see .env.example). */
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'local-demo-only-2026';

/**
 * Password checks are deliberately slow (scrypt, production cost). With several browsers signing
 * in at once on one machine an answer can take a few seconds, so allow for that here only.
 */
const SIGN_IN = { timeout: 15_000 };

async function passwordSignIn(page: Page, username: string, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel(/Username or email/).fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.describe('sign-in against the real API', () => {
  test('username and password sign in; the session cookie is invisible to page scripts', async ({
    page,
    context,
  }) => {
    await passwordSignIn(page, 'demo.hr');
    await expect(page).toHaveURL('/dashboard', SIGN_IN);
    await expect(page.getByRole('button', { name: 'Account menu for Demo HR' })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === 'erp_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api' });
    expect(await page.evaluate(() => document.cookie)).not.toContain('erp_session');
  });

  test('a wrong password is refused with a clear message', async ({ page }) => {
    await passwordSignIn(page, 'demo.hr', 'definitely not right');
    await expect(page.getByRole('alert')).toContainText('Sign-in failed', SIGN_IN);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/^Password/)).toHaveValue('');
  });

  test('a leaver cannot sign in, and gets the same message as a wrong password', async ({
    page,
  }) => {
    await passwordSignIn(page, 'demo.leaver');
    await expect(page.getByRole('alert')).toContainText('Sign-in failed', SIGN_IN);
  });

  test('a new starter must choose a password before anything else', async ({ page }) => {
    await passwordSignIn(page, 'demo.newstarter');
    await expect(page).toHaveURL('/change-password', SIGN_IN);
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    // Typing a URL does not get round it.
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/change-password/);
    // The live checklist follows the shared rules.
    await page.getByLabel(/^New password/).fill('short');
    await expect(page.getByText('At least 12 characters (not met yet)')).toBeVisible();
    // Leave the seeded account as it is (so the suite can run again): sign out instead.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('after sign-out the session no longer works, even with the old cookie', async ({
    page,
    context,
  }) => {
    await passwordSignIn(page, 'demo.purchase');
    await expect(page).toHaveURL('/dashboard', SIGN_IN);
    const cookie = (await context.cookies()).find((c) => c.name === 'erp_session')!;
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Replaying the old cookie straight at the API is refused.
    const res = await page.request.get('/api/auth/me', {
      headers: { Cookie: `erp_session=${cookie.value}` },
    });
    expect(res.status()).toBe(401);
  });

  test('the API refuses a write without the client header (CSRF defence)', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: 'demo.finance', password: DEMO_PASSWORD },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('CLIENT_HEADER_MISSING');
  });
});
