// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // optional - aliases ke liye

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Base path (agar GitHub Pages ya subfolder pe deploy kar rahe ho toh change karna)
  base: '/',

  // Env variables handling – .env files se VITE_ prefix wale variables automatically available hote hain
  // process.env ko define karne ki zarurat nahi, lekin agar chahiye toh rakh sakte ho
  define: {
    // 'process.env': {} // optional - agar purane code mein process.env use ho raha ho
  },

  // Resolve aliases – src folder ko @ se access karne ke liye (optional lekin bahut helpful)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },

  // CSS/PostCSS config – Tailwind ke liye must
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },

  // Build optimizations (Vercel ke liye helpful)
  build: {
    // Sourcemap for debugging (production mein false kar sakte ho)
    sourcemap: true,

    // Chunk size warning threshold (optional)
    chunkSizeWarningLimit: 1000,

    // Rollup options – minification aur tree-shaking better karne ke liye
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

  // Server config for local dev (optional)
  server: {
    port: 5173,
    open: true, // browser auto open
    hmr: true,
  },
});
