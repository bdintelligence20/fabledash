/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f1fe',
          100: '#e0e3fd',
          200: '#c1c7fb',
          300: '#a2aaf9',
          400: '#848ef7',
          500: '#6571f5', // Main primary color
          600: '#515bf4',
          700: '#3d48f2',
          800: '#2935f1',
          900: '#1521ef',
        },
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
        },
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
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 30px rgba(0, 0, 0, 0.1)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6571f5 0%, #3d48f2 100%)',
      },
    },
  },
  plugins: [],
};
