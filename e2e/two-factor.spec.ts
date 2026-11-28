import { createHmac } from 'node:crypto';
import { type Page, expect, test } from '@playwright/test';

/** FAKE demo values (see .env.example): demo.admin has two-factor on with this secret. */
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'local-demo-only-2026';
const DEMO_TOTP_SECRET = process.env.E2E_DEMO_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const SLOW = { timeout: 15_000 };

function base32(text: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** What an authenticator app shows now (RFC 6238), as an independent check of the server. */
function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', base32(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 15;
  const n = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, '0');
}

async function passwordSignIn(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel(/Username or email/).fill(username);
  await page.getByLabel(/^Password/).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// demo.admin is one shared account and each code works once: run these one after another.
test.describe.configure({ mode: 'serial' });

test.describe('two-factor sign-in against the real API', () => {
  test('demo.admin: password, then the code from the authenticator app', async ({ page }) => {
    await passwordSignIn(page, 'demo.admin');
    await expect(page).toHaveURL(/\/two-factor/, SLOW);
    // Nothing else opens while the code is still to come.
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/two-factor/);

    await page.getByLabel(/6-digit code/).fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('alert')).toContainText('not right');

    // A code from a step already used (e.g. by an earlier run) is refused: wait for a new one.
    const firstStep = Math.floor(Date.now() / 30_000);
    await page.getByLabel(/6-digit code/).fill(totp(DEMO_TOTP_SECRET));
    await page.getByRole('button', { name: 'Verify' }).click();
    const signedIn = page.getByRole('button', { name: 'Account menu for Demo Admin' });
    if (!(await signedIn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      while (Math.floor(Date.now() / 30_000) === firstStep) await page.waitForTimeout(500);
      await page.getByLabel(/6-digit code/).fill(totp(DEMO_TOTP_SECRET));
      await page.getByRole('button', { name: 'Verify' }).click();
    }
    await expect(signedIn).toBeVisible(SLOW);
    await expect(page).toHaveURL('/finance');
  });

  test('demo.director (required, not set up): the setup step with a QR code comes first', async ({
    page,
  }) => {
    await passwordSignIn(page, 'demo.director');
    await expect(page).toHaveURL(/\/two-factor\/setup/, SLOW);
    await expect(page.getByRole('img', { name: /QR code to scan/ })).toBeVisible();
    await expect(page.getByLabel('Setup key')).toHaveText(/^[A-Z2-7 ]{39}$/);
    // Leave the seeded account as it is (so the suite can run again): sign out instead.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
