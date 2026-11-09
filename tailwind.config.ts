import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FDFBEA',
        card: '#FFFEF7',
        border: '#EADFC7',
        sand: '#F4E7CC',
        sandLight: '#FAF3E3',
        orange: {
          DEFAULT: '#CE5535',
          dark: '#A8401F',
          soft: '#FBEDE3',
        },
        espresso: {
          DEFAULT: '#2B1A12',
          muted: '#75604F',
          dark: '#1C100A',
        },
        mustard: {
          DEFAULT: '#E8B125',
          soft: '#FEF6D9',
        },
        brandGreen: '#2F7A3E',
        brandRed: '#BA1A1A',
      },
      borderRadius: {
        card: '20px',
        'card-lg': '24px',
      },
      boxShadow: {
        orange: '0 8px 24px -4px rgba(206, 85, 53, 0.3)',
        'orange-sm': '0 4px 12px -2px rgba(206, 85, 53, 0.25)',
        card: '0 4px 20px -2px rgba(43, 26, 18, 0.05)',
        float: '0 10px 30px -4px rgba(43, 26, 18, 0.12)',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
