import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'convex', test: /node_modules[\\/](@convex|convex)[\\/]/, priority: 15 },
            { name: 'clerk', test: /node_modules[\\/]@clerk[\\/]/, priority: 15 },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 15 },
            { name: 'router', test: /node_modules[\\/](react-router|react-router-dom)[\\/]/, priority: 15 },
          ],
        },
      },
    },
  },
})
