/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
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
          'bg-dark': '#0B0F17',
          surface: '#FFFFFF',
          'surface-dark': '#111827',
          'surface-elevated': '#F1F5F9',
          'surface-elevated-dark': '#1E293B',
          border: 'rgba(226, 232, 240, 0.8)',
          'border-dark': 'rgba(255, 255, 255, 0.08)',
          primary: '#2457D6',
          'primary-dark': '#60A5FA',
          'primary-hover': '#1B44B0',
          'primary-light': '#EEF2FF',
          dark: '#0F172A',
          muted: '#64748B',
          'muted-dark': '#A8B4C7',
        },
      },
      boxShadow: {
        'glass-sm': '0 2px 8px -1px rgba(15, 23, 42, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        'glass-md': '0 8px 24px -4px rgba(15, 23, 42, 0.07), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
        'glass-lg': '0 16px 36px -6px rgba(15, 23, 42, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 1)',
        'glass-modal': '0 24px 48px -12px rgba(15, 23, 42, 0.18), inset 0 1px 0 0 rgba(255, 255, 255, 1)',
        'glass-dark-sm': '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glass-dark-md': '0 12px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'glass-dark-lg': '0 24px 48px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
      },
    },
  },
  plugins: [],
};
