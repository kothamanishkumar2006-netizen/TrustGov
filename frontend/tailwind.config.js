/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4f9',
          100: '#e1e9f2',
          200: '#c2d3e5',
          300: '#a3bdd9',
          450: '#1b3b6f',
          500: '#11223f',
          600: '#0c1626',
          700: '#070a12',
        },
        cyber: {
          neonBlue: '#00d2ff',
          emerald: '#10b981',
          crimson: '#ef4444',
          gold: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
