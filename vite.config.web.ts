import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cspPlugin } from './scripts/csp-plugin'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: resolve(rootDir, 'src/renderer'),
  plugins: [react(), cspPlugin(() => process.env.NODE_ENV !== 'production')],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src/renderer/src'),
      '@shared': resolve(rootDir, 'src/shared'),
      '@examples': resolve(rootDir, 'examples')
    }
  },
  server: {
    port: 5174,
    strictPort: true
  }
})
