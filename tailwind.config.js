/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-cyan': 'var(--accent-cyan)',
        'accent-blue': 'var(--accent-blue)',
      },
      borderRadius: {
        '56': '56px',
        '48': '48px',
        '40': '40px',
      },
      spacing: {
        '128': '32rem',
      },
    },
  },
  plugins: [],
}
