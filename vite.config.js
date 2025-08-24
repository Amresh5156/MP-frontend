import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Ensure React is properly imported in production
      jsxImportSource: 'react'
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log statements in production
        drop_debugger: true
      }
    },
    sourcemap: false, // Disable source maps in production to reduce bundle size
    rollupOptions: {
      output: {
        // Remove manual chunking that's causing React loading issues
        // Let Vite handle chunking automatically for React 18
      },
      external: ['/models/**'] // Exclude models folder from build
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['face-api.js'] // Exclude face-api.js from pre-bundling to enable dynamic import
  },
  define: {
    // Ensure React is globally available
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  },
  publicDir: 'public' // Ensure public folder is copied
})
