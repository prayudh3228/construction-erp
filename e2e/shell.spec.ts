import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

/** Set E2E_SCREENSHOT_DIR (e.g. docs/screenshots) to save the key screens for the PR. */
const shotDir = process.env.E2E_SCREENSHOT_DIR;
async function shot(page: Page, name: string, fullPage = false) {
  if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage });
}

async function demoSignIn(page: Page, path = '/') {
  await page.goto(path);
  await page.getByRole('button', { name: 'Continue as demo user' }).click();
}

/** WCAG 2.1 AA in a real browser, including colour contrast. */
async function expectNoA11yViolations(page: Page) {
  // Toasts fade in; scanning mid-fade measures a half-transparent colour. Wait until settled.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-sonner-toast]')].every(
      (t) => getComputedStyle(t).opacity === '1',
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([]);
}

const DEPARTMENTS = [
  'Management dashboard',
  'Planning',
  'Execution (site)',
  'Purchase',
  'Stores and inventory',
  'Equipment and hire',
  'Accounts and finance',
  'Sales',
  'HR and labour',
  'Quality',
  'Safety',
  'Legal and compliance',
  'Admin',
];

test.describe('login', () => {
  test('validates inline and passes an accessibility scan', async ({ page }) => {
    await page.goto('/login');
    await shot(page, 'phase-01-login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your username or email.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await expect(page.getByLabel(/Username or email/)).toBeFocused();
    await expectNoA11yViolations(page);
  });

  test('a signed-out deep link goes to login and comes back after demo sign-in', async ({
    page,
  }) => {
    await page.goto('/purchase?project=PRJ-003');
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await page.getByRole('button', { name: 'Continue as demo user' }).click();
    await expect(page).toHaveURL('/purchase?project=PRJ-003');
    await expect(
      page.getByRole('heading', { level: 2, name: 'District Hospital Annexe' }),
    ).toBeVisible();
  });
});

test.describe('shell', () => {
  test('every department in the sidebar opens', async ({ page }) => {
    await demoSignIn(page);
    await expect(page).toHaveURL('/dashboard');
    const nav = page.getByRole('navigation', { name: 'Departments' });
    for (const [i, name] of DEPARTMENTS.entries()) {
      await nav.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveTitle(`${name} · Construction ERP`);
      // Focus moves to the new page's heading, so screen readers announce the page. (The first
      // link is the page we start on, so clicking it does not navigate.)
      if (i > 0) await expect(page.getByRole('heading', { level: 1, name })).toBeFocused();
    }
  });

  test('the project choice survives a reload and carries across departments', async ({ page }) => {
    await demoSignIn(page, '/finance');
    await page.getByRole('button', { name: /^Project: / }).click();
    await page.getByPlaceholder(/Search by code/).fill('greenfield');
    await page.getByRole('option', { name: /PRJ-002/ }).click();
    await expect(page).toHaveURL('/finance?project=PRJ-002');
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Greenfield Homes, Phase 1' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Project: PRJ-002/ })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Departments' })
      .getByRole('link', { name: 'Sales' })
      .click();
    await expect(page).toHaveURL('/sales?project=PRJ-002');
    await shot(page, 'phase-01-project-view');
  });

  test('works with the keyboard alone', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    // Tab to the demo button and press Enter.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Continue as demo user' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/dashboard');

    // First Tab from the top of the page reaches the skip link, which jumps to the content.
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    // Ctrl+K opens the project switcher; type and Enter chooses.
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder(/Search by code/)).toBeFocused();
    await page.keyboard.type('company');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/dashboard?project=company');
    await expect(page.getByRole('heading', { level: 2, name: 'Company-wide' })).toBeVisible();
  });

  test('desktop screens pass an accessibility scan', async ({ page }) => {
    await demoSignIn(page, '/finance');
    await expect(page.getByRole('table', { name: 'Projects' })).toBeVisible();
    await shot(page, 'phase-01-finance-all-projects', true);
    await expectNoA11yViolations(page);

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('listbox')).toBeVisible();
    await shot(page, 'phase-01-project-switcher');
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');

    await page.goto('/design-system');
    await expect(page.getByRole('table', { name: 'Sample bills' })).toBeVisible();
    await shot(page, 'phase-01-design-system', true);
    await expectNoA11yViolations(page);
  });

  test('collapsed sidebar keeps working and is remembered', async ({ page }) => {
    await demoSignIn(page, '/planning');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    const nav = page.getByRole('navigation', { name: 'Departments' });
    await nav.getByRole('link', { name: 'Purchase' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Purchase' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('sign out returns to login and protects the pages again', async ({ page }) => {
    await demoSignIn(page, '/hr');
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
    await page.goto('/hr');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test('sidebar becomes a drawer that closes after navigating', async ({ page }) => {
    await demoSignIn(page, '/finance');
    await expect(page.getByRole('navigation', { name: 'Departments' })).toBeHidden();
    await shot(page, 'phase-01-tablet');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    await shot(page, 'phase-01-tablet-drawer');
    await expectNoA11yViolations(page);
    await drawer.getByRole('link', { name: 'Quality' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Quality' })).toBeVisible();
  });

  test('Sales explains why a contract project has nothing to show', async ({ page }) => {
    await demoSignIn(page, '/sales?project=PRJ-001');
    await expect(
      page.getByRole('heading', { name: 'Sales covers development projects only' }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
