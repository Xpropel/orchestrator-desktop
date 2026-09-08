import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cspPlugin } from './scripts/csp-plugin'
import { privateLibraryResolve } from './scripts/private-library-resolve'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: resolve(rootDir, 'src/renderer'),
  plugins: [
    privateLibraryResolve(rootDir),
    react(),
    cspPlugin(() => process.env.NODE_ENV !== 'production')
  ],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src/renderer/src'),
      '@shared': resolve(rootDir, 'src/shared'),
      '@examples': resolve(rootDir, 'examples'),
      '@private': resolve(rootDir, 'private')
    }
  },
  server: {
    port: 5174,
    strictPort: true
  }
})
