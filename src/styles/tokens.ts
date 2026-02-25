/**
 * Design tokens for FableDash
 *
 * Use Tailwind classes wherever possible. These tokens exist for contexts
 * where Tailwind classes cannot be used (chart libraries, canvas, SVG fills).
 *
 * All values mirror tailwind.config.js — keep them in sync.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  /** Indigo-blue brand color. Navigation, CTAs, active states. */
  primary: {
    50: '#f0f1fe',
    100: '#e0e3fd',
    200: '#c1c7fb',
    300: '#a2aaf9',
    400: '#848ef7',
    500: '#6571f5',
    600: '#515bf4',
    700: '#3d48f2',
    800: '#2935f1',
    900: '#1521ef',
    950: '#0d15c4',
  },
  /** Cool slate-blue. Secondary actions, muted elements. */
  secondary: {
    50: '#f5f7fa',
    100: '#ebeef5',
    200: '#d8deeb',
    300: '#c4cde1',
    400: '#b1bdd7',
    500: '#9daccd',
    600: '#8a9bc3',
    700: '#768bb9',
    800: '#637aaf',
    900: '#4f6aa5',
    950: '#3b5291',
  },
  /** Warm amber/orange. Highlights, notifications, creative energy. */
  accent: {
    50: '#fff8f0',
    100: '#fff1e0',
    200: '#ffe3c2',
    300: '#ffd5a3',
    400: '#ffc785',
    500: '#ffb966',
    600: '#ffab47',
    700: '#ff9d29',
    800: '#ff8f0a',
    900: '#eb7c00',
    950: '#c46600',
  },
  /** Green. Positive states, revenue up, healthy metrics. */
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  /** Amber/yellow. Caution states, approaching limits. */
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  /** Red. Errors, negative metrics, destructive actions. */
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  /** Warm-ish neutral gray. Backgrounds, cards, borders. */
  surface: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
    950: '#0c0a09',
  },
} as const;

export type ColorScale = typeof colors;

// ---------------------------------------------------------------------------
// Spacing (key values in rem — mirrors tailwind.config.js extend.spacing)
// ---------------------------------------------------------------------------

export const spacing = {
  '4.5': '1.125rem',
  '18': '4.5rem',
  '88': '22rem',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  fontFamily: "'Inter', system-ui, sans-serif",
  scale: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    display: '3rem',
  },
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export const shadows = {
  card: '0 4px 20px rgba(0, 0, 0, 0.05)',
  'card-hover': '0 10px 30px rgba(0, 0, 0, 0.1)',
  soft: '0 2px 8px rgba(0, 0, 0, 0.04)',
  medium: '0 4px 12px rgba(0, 0, 0, 0.08)',
  strong: '0 8px 24px rgba(0, 0, 0, 0.12)',
  'glow-primary': '0 0 20px rgba(101, 113, 245, 0.15)',
  'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
} as const;

// ---------------------------------------------------------------------------
// Chart Colors — For data visualization (Recharts, Chart.js, D3, etc.)
// ---------------------------------------------------------------------------

export const chartColors = {
  /** 6-color categorical palette for distinct data series */
  categorical: [
    colors.primary[500],
    colors.accent[500],
    colors.success[500],
    colors.secondary[500],
    colors.warning[500],
    colors.danger[500],
  ],
  /** Sequential palette for ordered/gradient data (light to dark) */
  sequential: [
    colors.primary[100],
    colors.primary[300],
    colors.primary[500],
    colors.primary[700],
    colors.primary[900],
  ],
  /** Diverging palette for data with a neutral midpoint */
  diverging: [
    colors.danger[500],
    colors.danger[300],
    colors.surface[300],
    colors.success[300],
    colors.success[500],
  ],
} as const;

// ---------------------------------------------------------------------------
// Currency — South African Rand formatting
// ---------------------------------------------------------------------------

export const currency = {
  symbol: 'R',
  code: 'ZAR',
  locale: 'en-ZA',
  format: (amount: number): string =>
    `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
} as const;
