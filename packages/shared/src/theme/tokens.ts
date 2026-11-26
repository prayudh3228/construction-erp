/**
 * Design tokens: the ONE place where colours, type, spacing, radii, shadows and motion are set.
 * Web turns these into CSS variables (`apps/web/src/styles/theme.generated.css`), mobile reads
 * them directly. Change branding here, run `pnpm --filter @erp/web theme`, and both apps follow.
 *
 * The colours are a calm, neutral PLACEHOLDER palette. The company's real brand colours will be
 * supplied later (OPEN_QUESTIONS Q2); only the `brand` scale needs to change when they arrive.
 */

/** Neutral greys (slate). */
export const neutral = {
  0: '#ffffff',
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const;

/** Placeholder brand scale (a muted steel blue). Replace with the company's colours. */
export const brand = {
  50: '#f2f6fa',
  100: '#e1eaf3',
  200: '#c3d4e6',
  300: '#97b4d2',
  400: '#6a91ba',
  500: '#4a74a1',
  600: '#3a5d85',
  700: '#2f4b6c',
  800: '#283f5a',
  900: '#22344a',
} as const;

const status = {
  green: { 50: '#ecfdf5', 200: '#a7f3d0', 600: '#059669', 700: '#047857', 800: '#065f46' },
  amber: { 50: '#fffbeb', 200: '#fde68a', 600: '#d97706', 700: '#b45309', 800: '#92400e' },
  red: { 50: '#fef2f2', 200: '#fecaca', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b' },
  blue: { 50: '#eff6ff', 200: '#bfdbfe', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' },
} as const;

/** Semantic colour roles. Components use these names, never raw scale values. */
export interface SemanticColors {
  background: string;
  surface: string;
  'surface-muted': string;
  'surface-raised': string;
  foreground: string;
  'muted-foreground': string;
  border: string;
  'border-strong': string;
  input: string;
  ring: string;
  primary: string;
  'primary-hover': string;
  'primary-foreground': string;
  secondary: string;
  'secondary-hover': string;
  'secondary-foreground': string;
  accent: string;
  'accent-foreground': string;
  sidebar: string;
  'sidebar-foreground': string;
  'sidebar-muted-foreground': string;
  'sidebar-active': string;
  'sidebar-active-foreground': string;
  'sidebar-border': string;
  success: string;
  'success-subtle': string;
  'success-foreground': string;
  warning: string;
  'warning-subtle': string;
  'warning-foreground': string;
  danger: string;
  'danger-hover': string;
  'danger-subtle': string;
  'danger-foreground': string;
  info: string;
  'info-subtle': string;
  'info-foreground': string;
  overlay: string;
}

export const lightColors: SemanticColors = {
  background: neutral[50],
  surface: neutral[0],
  'surface-muted': neutral[100],
  'surface-raised': neutral[0],
  foreground: neutral[900],
  'muted-foreground': neutral[600],
  border: neutral[200],
  'border-strong': neutral[300],
  // Form field borders must reach 3:1 against the surface (WCAG 1.4.11), so not neutral[300].
  input: '#8593a8',
  ring: status.blue[600],
  primary: brand[700],
  'primary-hover': brand[800],
  'primary-foreground': neutral[0],
  secondary: neutral[100],
  'secondary-hover': neutral[200],
  'secondary-foreground': neutral[900],
  accent: brand[50],
  'accent-foreground': brand[800],
  sidebar: neutral[0],
  'sidebar-foreground': neutral[700],
  'sidebar-muted-foreground': neutral[600],
  'sidebar-active': brand[50],
  'sidebar-active-foreground': brand[800],
  'sidebar-border': neutral[200],
  success: status.green[700],
  'success-subtle': status.green[50],
  'success-foreground': status.green[800],
  warning: status.amber[600],
  'warning-subtle': status.amber[50],
  'warning-foreground': status.amber[800],
  danger: status.red[700],
  'danger-hover': status.red[800],
  'danger-subtle': status.red[50],
  'danger-foreground': status.red[800],
  info: status.blue[700],
  'info-subtle': status.blue[50],
  'info-foreground': status.blue[800],
  overlay: 'rgb(15 23 42 / 0.4)',
};

/** Dark theme is defined so the structure supports it, but it is not switched on yet (A16). */
export const darkColors: SemanticColors = {
  background: neutral[950],
  surface: neutral[900],
  'surface-muted': neutral[800],
  'surface-raised': neutral[800],
  foreground: neutral[50],
  'muted-foreground': neutral[400],
  border: neutral[800],
  'border-strong': neutral[700],
  input: neutral[500],
  ring: '#60a5fa',
  primary: brand[300],
  'primary-hover': brand[200],
  'primary-foreground': neutral[950],
  secondary: neutral[800],
  'secondary-hover': neutral[700],
  'secondary-foreground': neutral[50],
  accent: brand[900],
  'accent-foreground': brand[100],
  sidebar: neutral[900],
  'sidebar-foreground': neutral[200],
  'sidebar-muted-foreground': neutral[400],
  'sidebar-active': brand[900],
  'sidebar-active-foreground': brand[100],
  'sidebar-border': neutral[800],
  success: '#34d399',
  'success-subtle': '#052e22',
  'success-foreground': '#6ee7b7',
  warning: '#fbbf24',
  'warning-subtle': '#3a2604',
  'warning-foreground': '#fcd34d',
  danger: '#f87171',
  'danger-hover': '#fca5a5',
  'danger-subtle': '#3b0d0d',
  'danger-foreground': '#fca5a5',
  info: '#60a5fa',
  'info-subtle': '#0c1f45',
  'info-foreground': '#93c5fd',
  overlay: 'rgb(2 6 23 / 0.6)',
};

export const typography = {
  fontSans: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
  fontMono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
  /** [font size, line height] in px. Web converts to rem. */
  scale: {
    xs: [12, 16],
    sm: [14, 20],
    base: [15, 24],
    lg: [17, 26],
    xl: [20, 28],
    '2xl': [24, 32],
    '3xl': [30, 38],
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

/** Spacing base unit in px. Tailwind's spacing scale is multiples of this (p-1 = 4px). */
export const spacingUnit = 4;

/** Radii in px. */
export const radii = { sm: 4, md: 6, lg: 8, xl: 12, full: 9999 } as const;

export const shadows = {
  xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
  sm: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
  md: '0 4px 8px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
  lg: '0 12px 24px -6px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.06)',
} as const;

export const motion = {
  durationFast: '120ms',
  durationBase: '180ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/** Layout sizes in px used by both shells. */
export const layout = {
  sidebarWidth: 256,
  sidebarCollapsedWidth: 64,
  topBarHeight: 56,
  /** Minimum touch target on mobile (dp) and for primary touch controls on web. */
  touchTarget: 48,
} as const;

export const tokens = {
  colors: { light: lightColors, dark: darkColors },
  typography,
  spacingUnit,
  radii,
  shadows,
  motion,
  layout,
} as const;

export type Tokens = typeof tokens;
