import axe from 'axe-core';

/**
 * Run axe-core on a container and return readable violations. Colour contrast is skipped here
 * because jsdom does not compute styles; contrast is checked on the tokens (shared tests) and in
 * the browser (Playwright E2E).
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}
