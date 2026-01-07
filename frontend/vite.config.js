import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from other systems on the network
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        // target: 'http://173.249.6.61:8008',

        changeOrigin: true
      }
    }
  }
})






