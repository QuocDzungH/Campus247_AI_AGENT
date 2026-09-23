/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        campus: {
          bg: '#F5F7FB',
          card: 'rgba(255, 255, 255, 0.78)',
          'card-hover': 'rgba(255, 255, 255, 0.92)',
          border: 'rgba(226, 232, 240, 0.8)',
          primary: '#2457D6',
          'primary-hover': '#1B44B0',
          'primary-light': '#EEF2FF',
          dark: '#0F172A',
          muted: '#64748B',
        },
      },
      boxShadow: {
        'glass-sm': '0 2px 8px -1px rgba(15, 23, 42, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        'glass-md': '0 8px 24px -4px rgba(15, 23, 42, 0.07), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
        'glass-lg': '0 16px 36px -6px rgba(15, 23, 42, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 1)',
        'glass-modal': '0 24px 48px -12px rgba(15, 23, 42, 0.18), inset 0 1px 0 0 rgba(255, 255, 255, 1)',
      },
    },
  },
  plugins: [],
};

