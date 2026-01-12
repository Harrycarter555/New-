// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Agar .env variables use kar rahe ho toh yeh optional
  define: {
    'process.env': {},
  },
})
