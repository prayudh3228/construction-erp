import { describe, expect, it } from 'vitest';
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
  contrastRatio,
  parseHex,
  relativeLuminance,
} from './contrast.js';
import { tokensToCss } from './css.js';
import { type SemanticColors, darkColors, lightColors, tokens } from './tokens.js';

describe('contrast helpers', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#0F172A')).toEqual([15, 23, 42]);
    expect(() => parseHex('rgb(0 0 0)')).toThrow();
    expect(() => parseHex('#12345')).toThrow();
  });

  it('matches the WCAG reference values', () => {
    // Black and white: luminance 0 and 1, contrast (1 + 0.05) / (0 + 0.05) = 21.
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(contrastRatio('#000', '#fff')).toBe(21);
    // Order does not matter, and a colour against itself is 1.
    expect(contrastRatio('#fff', '#000')).toBe(21);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
    // #767676 on white is the classic "just passes AA" grey: 4.54:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});

type Pair = [fg: keyof SemanticColors, bg: keyof SemanticColors];

/** Text that must be readable (4.5:1) on its background. */
const TEXT_PAIRS: Pair[] = [
  ['foreground', 'background'],
  ['foreground', 'surface'],
  ['foreground', 'surface-muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'surface'],
  ['muted-foreground', 'surface-muted'],
  ['primary', 'surface'],
  ['primary', 'background'],
  ['primary-foreground', 'primary'],
  ['primary-foreground', 'primary-hover'],
  ['secondary-foreground', 'secondary'],
  ['secondary-foreground', 'secondary-hover'],
  ['accent-foreground', 'accent'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-muted-foreground', 'sidebar'],
  ['sidebar-active-foreground', 'sidebar-active'],
  ['success-foreground', 'success-subtle'],
  ['warning-foreground', 'warning-subtle'],
  ['danger-foreground', 'danger-subtle'],
  ['info-foreground', 'info-subtle'],
  ['danger', 'surface'],
  ['success', 'surface'],
  ['info', 'surface'],
  ['surface', 'danger'],
  ['surface', 'danger-hover'],
];

/** UI parts (focus ring, form field borders, warning icons) need 3:1 against what is behind them. */
const NON_TEXT_PAIRS: Pair[] = [
  ['ring', 'background'],
  ['ring', 'surface'],
  ['input', 'surface'],
  ['warning', 'surface'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s theme contrast', (_name, colors) => {
  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it.each(NON_TEXT_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  it('defines every role the light theme defines', () => {
    expect(Object.keys(colors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});

describe('tokensToCss', () => {
  const css = tokensToCss();

  it('writes every light colour as a variable and maps it to a Tailwind colour', () => {
    for (const [name, value] of Object.entries(lightColors)) {
      expect(css).toContain(`--${name}: ${value};`);
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
  });

  it('writes the dark colours under data-theme="dark"', () => {
    const dark = css.slice(css.indexOf("[data-theme='dark']"), css.indexOf('@theme inline'));
    for (const [name, value] of Object.entries(darkColors)) {
      expect(dark).toContain(`--${name}: ${value};`);
    }
  });

  it('converts px to rem (16px = 1rem)', () => {
    // base text 15px / 16 = 0.9375rem; line 24px / 16 = 1.5rem.
    expect(css).toContain('--text-base: 0.9375rem;');
    expect(css).toContain('--text-base--line-height: 1.5rem;');
    // radius lg 8px = 0.5rem; full stays a pixel pill.
    expect(css).toContain('--radius-lg: 0.5rem;');
    expect(css).toContain('--radius-full: 9999px;');
    // Sidebar 256px = 16rem.
    expect(css).toContain('--sidebar-width: 16rem;');
  });

  it('is deterministic', () => {
    expect(tokensToCss()).toBe(css);
  });

  it('uses the placeholder font stack', () => {
    expect(css).toContain(`--font-sans: ${tokens.typography.fontSans};`);
  });
});
