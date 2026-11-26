import { type SemanticColors, tokens } from './tokens.js';

const px = (n: number) => `${n / 16}rem`;

function colorVars(colors: SemanticColors, indent: string): string {
  return Object.entries(colors)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join('\n');
}

/**
 * Render the tokens as a Tailwind 4 stylesheet. Raw values live in `:root` (and
 * `[data-theme='dark']`); `@theme inline` maps them to Tailwind utilities such as `bg-surface`,
 * `text-muted-foreground`, `rounded-lg` and `shadow-sm`.
 */
export function tokensToCss(): string {
  const { colors, typography, radii, shadows, motion, layout } = tokens;
  const names = Object.keys(colors.light);

  const themeColors = names.map((n) => `  --color-${n}: var(--${n});`).join('\n');
  const text = Object.entries(typography.scale)
    .map(
      ([k, [size, line]]) =>
        `  --text-${k}: ${px(size)};\n  --text-${k}--line-height: ${px(line)};`,
    )
    .join('\n');
  const radius = Object.entries(radii)
    .map(([k, v]) => `  --radius-${k}: ${v === 9999 ? '9999px' : px(v)};`)
    .join('\n');
  const shadow = Object.entries(shadows)
    .map(([k, v]) => `  --shadow-${k}: ${v};`)
    .join('\n');

  return `/* GENERATED from packages/shared/src/theme/tokens.ts. Do not edit by hand. */
/* Regenerate with: pnpm --filter @erp/web theme */

:root {
${colorVars(colors.light, '  ')}
  --sidebar-width: ${px(layout.sidebarWidth)};
  --sidebar-collapsed-width: ${px(layout.sidebarCollapsedWidth)};
  --topbar-height: ${px(layout.topBarHeight)};
  --touch-target: ${px(layout.touchTarget)};
  --duration-fast: ${motion.durationFast};
  --duration-base: ${motion.durationBase};
  --ease-standard: ${motion.easing};
  color-scheme: light;
}

[data-theme='dark'] {
${colorVars(colors.dark, '  ')}
  color-scheme: dark;
}

@theme inline {
  --font-sans: ${typography.fontSans};
  --font-mono: ${typography.fontMono};
${themeColors}
${text}
${radius}
${shadow}
}
`;
}
