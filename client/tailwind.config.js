/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hitster: {
          yellow: '#FFD600',
          dark: '#1A1A2E',
          card: '#16213E',
          accent: '#E94560',
        },
      },
    },
  },
  plugins: [],
};
