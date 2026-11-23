import { defineConfig } from 'vite'

// The production server owns the API and cookies. Keep Vite's local UI same-origin.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        configure(proxy) {
          proxy.on('proxyReq', (outgoing, incoming) => {
            if (incoming.headers.origin === 'http://' + incoming.headers.host)
              outgoing.setHeader('origin', 'http://localhost:3000')
          })
        },
      },
    },
  },
})
