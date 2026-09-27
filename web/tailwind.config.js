/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ibm: {
          blue: '#0f62fe',
          blueHover: '#0353e9',
          gray10: '#f4f4f4',
          gray20: '#e0e0e0',
          gray30: '#c6c6c6',
          gray60: '#525252',
          gray80: '#393939',
          gray100: '#161616',
          red: '#da1e28',
          green: '#24a148',
          yellow: '#f1c21b', // Signature IBM yellow
          yellowHover: '#e5b619',
        }
      },
      fontFamily: {
        // Carbon uses IBM Plex, falling back to standard sans
        sans: ['"IBM Plex Sans"', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
