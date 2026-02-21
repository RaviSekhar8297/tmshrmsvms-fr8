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
        changeOrigin: true,
        secure: false,
        timeout: 30000, // 30 seconds timeout
        proxyTimeout: 30000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Only log non-ECONNRESET errors to reduce noise
            if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED') {
              console.log('Proxy error:', err.message);
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Set longer timeout for requests
            proxyReq.setTimeout(30000);
          });
        }
      }
    }
  }
})






