import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { privateLibraryResolve } from './scripts/private-library-resolve'

export default defineConfig({
  plugins: [privateLibraryResolve()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@examples': path.resolve(__dirname, 'examples'),
      '@private': path.resolve(__dirname, 'private')
    }
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['src/renderer/src/test/setup.ts']
  }
})
