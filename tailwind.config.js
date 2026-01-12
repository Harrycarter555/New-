/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",  // Yeh already hai – theek hai
  ],
  safelist: [                    // Yeh add karo – important classes force generate kar dega
    'bg-black',
    'text-white',
    'text-cyan-400',
    'bg-cyan-500',
    'rounded-[56px]',
    'rounded-[64px]',
    'rounded-[48px]',
    'glass-panel',
    'animate-slide',
    'border-t-8',
    'px-5',
    'max-w-lg',
    'mx-auto',
    'min-h-screen',
    'pb-40',
    'shadow-2xl',
    'font-black',
    'tracking-widest',
    'uppercase',
    'italic',
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
