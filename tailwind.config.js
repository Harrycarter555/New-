/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-cyan': '#00d2ff',
        'accent-blue': '#3a7bd5',
      },
      borderRadius: {
        '56': '56px',
        '64': '64px',
        '48': '48px',
      },
    },
  },
  plugins: [],
}
