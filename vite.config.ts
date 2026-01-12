// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';      // ← yeh import add kiya
import autoprefixer from 'autoprefixer';   // ← yeh import add kiya
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Base path (agar subfolder deploy kar rahe ho toh change karna)
  base: '/',

  // Env variables (VITE_ prefix wale automatically kaam karte hain)
  define: {},

  // Resolve aliases (optional – @ se src import karne ke liye)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },

  // CSS/PostCSS config – Tailwind ke liye yeh sahi tareeka hai
  css: {
    postcss: {
      plugins: [
        tailwindcss(),     // ← require ki jagah import use kiya
        autoprefixer(),    // ← require ki jagah import use kiya
      ],
    },
  },

  // Build optimizations (Vercel ke liye helpful)
  build: {
    sourcemap: true,  // debugging ke liye
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/firestore'],
          genai: ['@google/generative-ai'],
        },
      },
    },
  },

  // Local dev server config (optional)
  server: {
    port: 5173,
    open: true,
    hmr: true,
  },
});
