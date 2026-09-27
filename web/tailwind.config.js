/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0f172a',      // Deep indigo/slate for headers and terminal
          navyHover: '#1e293b', 
          amber: '#f59e0b',     // Signature yellowish/gold accent
          amberHover: '#d97706',
          bg: '#f8fafc',        // Main application background
          surface: '#ffffff',   // Card/Panel background
          border: '#e2e8f0',    // Crisp 1px lines
          text: '#334155',      // High legibility body text
          textMuted: '#64748b', // Secondary text
        },
        status: {
          success: '#059669',   // Emerald
          successBg: '#d1fae5',
          warning: '#d97706',   // Amber
          warningBg: '#fef3c7',
          danger: '#dc2626',    // Red
          dangerBg: '#fee2e2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'flat': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        'floating': '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
      }
    },
  },
  plugins: [],
}
