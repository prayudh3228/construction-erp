import { lightColors, tokens } from '@erp/shared';

/**
 * Mobile theme, built from the SAME shared tokens as the web app (packages/shared/src/theme), so a
 * branding change in tokens.ts reaches both. Only the light theme is used (A16).
 */
export const colors = lightColors;

/** Spacing in dp: space(4) = 16. Same 4-point grid as the web. */
export const space = (n: number): number => n * tokens.spacingUnit;

export const radii = tokens.radii;

/** Minimum touch target in dp (Android 48dp, iOS 44pt): every tappable thing is at least this. */
export const TOUCH_TARGET = tokens.layout.touchTarget;

/** Primary actions on site are bigger still, for gloves and one-handed use outdoors. */
export const PRIMARY_TOUCH_TARGET = 56;

type Scale = keyof typeof tokens.typography.scale;

/** Text styles. Body text on the phone is one step larger than on the web, for outdoor reading. */
function textStyle(scale: Scale, weight: keyof typeof tokens.typography.weight = 'regular') {
  const [fontSize, lineHeight] = tokens.typography.scale[scale];
  return {
    fontSize,
    lineHeight,
    fontWeight: String(tokens.typography.weight[weight]) as '400' | '500' | '600' | '700',
    color: colors.foreground,
  };
}

export const text = {
  title: textStyle('2xl', 'semibold'),
  heading: textStyle('xl', 'semibold'),
  subheading: textStyle('lg', 'semibold'),
  body: textStyle('lg'),
  bodyStrong: textStyle('lg', 'medium'),
  small: { ...textStyle('base'), color: colors['muted-foreground'] },
  caption: { ...textStyle('sm'), color: colors['muted-foreground'] },
  label: textStyle('base', 'medium'),
} as const;

export const shadow = {
  card: {
    shadowColor: colors.foreground,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;
