import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'classhi-bg': '#F7F8F7',
        'classhi-green': '#26BF87',
        'classhi-coral': '#B54557',
        'dark-bg': '#090B0D',
        'dark-card': '#0E1114',
        'dark-border': '#1C2126',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        ticker: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'price-flash-green': {
          '0%':   { backgroundColor: '#26BF87', color: '#ffffff' },
          '100%': { backgroundColor: 'transparent', color: 'inherit' },
        },
        'price-flash-coral': {
          '0%':   { backgroundColor: '#B54557', color: '#ffffff' },
          '100%': { backgroundColor: 'transparent', color: 'inherit' },
        },
      },
      animation: {
        'flash-green': 'price-flash-green 400ms ease-out forwards',
        'flash-coral': 'price-flash-coral 400ms ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;
