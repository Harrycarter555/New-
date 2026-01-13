import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CHANGED FROM '/' to './'
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // यह CSS और JS files को correct hash देगा
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
    // CSS को अलग file में generate करने के लिए
    cssCodeSplit: true,
    // CSS minify करने के लिए
    minify: 'terser'
  },
  // CSS optimization
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  }
})
