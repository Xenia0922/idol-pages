/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  hoverOnlyWhenSupported: true,
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        pink: {
          50: '#fef1f6',
          100: '#fde3ed',
          200: '#fbc7dc',
          300: '#f89cc1',
          400: '#f262a3',
          500: '#e83e8c',
          600: '#d61e6b',
          700: '#b81052',
          800: '#991044',
          900: '#7f123c',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Noto Sans JP"', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
