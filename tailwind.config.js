import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — Indigo-blue brand color. Navigation, CTAs, active states.
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
        // Secondary — Cool slate-blue. Secondary actions, muted elements.
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
        // Accent — Warm amber/orange. Highlights, notifications, creative energy.
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
        // Success — Green. Positive states, revenue up, healthy metrics.
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
        // Warning — Amber/yellow. Caution states, approaching limits.
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
        // Danger — Red. Errors, negative metrics, destructive actions.
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
        // Surface — Warm-ish neutral gray. Backgrounds, cards, borders.
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
      },

      // Typography
      fontFamily: {
        sans: ['Manrope', ...defaultTheme.fontFamily.sans],
        display: ['Manrope', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1' }],
      },

      // Spacing — supplements Tailwind defaults
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '88': '22rem',
      },

      // Border Radius
      borderRadius: {
        DEFAULT: '0.5rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // Shadows
      boxShadow: {
        card: '0 4px 20px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 30px rgba(0, 0, 0, 0.1)',
        soft: '0 2px 8px rgba(0, 0, 0, 0.04)',
        medium: '0 4px 12px rgba(0, 0, 0, 0.08)',
        strong: '0 8px 24px rgba(0, 0, 0, 0.12)',
        'glow-primary': '0 0 20px rgba(101, 113, 245, 0.15)',
        'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
      },

      // Background gradients
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6571f5 0%, #3d48f2 100%)',
        'gradient-accent': 'linear-gradient(135deg, #ffb966 0%, #ff8f0a 100%)',
        'gradient-dark': 'linear-gradient(180deg, #1c1917 0%, #292524 100%)',
      },

      // Animations
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 300ms ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
