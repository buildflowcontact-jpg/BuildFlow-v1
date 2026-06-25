/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f6ff',
          100: '#ecedfe',
          200: '#d9dbfd',
          300: '#b8bcfa',
          400: '#8d93f5',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#362f8c',
          900: '#272157',
        },
        violet: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(39, 33, 87, 0.04), 0 1px 3px 0 rgba(39, 33, 87, 0.05)',
        'card-hover': '0 4px 10px -2px rgba(39, 33, 87, 0.08), 0 12px 28px -6px rgba(39, 33, 87, 0.10)',
        soft: '0 2px 8px -2px rgba(39, 33, 87, 0.06), 0 8px 20px -6px rgba(39, 33, 87, 0.08)',
        popover: '0 8px 16px -4px rgba(39, 33, 87, 0.08), 0 20px 40px -8px rgba(39, 33, 87, 0.16)',
        glow: '0 0 0 1px rgba(99, 102, 241, 0.06), 0 10px 28px -8px rgba(99, 102, 241, 0.38)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, #ecedfe 0%, #f3e8ff 100%)',
      },
      borderRadius: {
        xl2: '1rem',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
