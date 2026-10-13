/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cyan: { 500: '#22d3ee' },
        blue: { 500: '#3b82f6' },
        neutral: { 300: '#d4d4d4', 400: '#a3a3a3', 900: '#171717', 950: '#0a0a0a' },
      }
    },
  },
  plugins: [],
}