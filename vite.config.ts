import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/proxy": "http://localhost:4000",
      "/proxy/market-data/ws": {
        target: "ws://localhost:4000",
        ws: true
      }
    },
  }
})

export default config
