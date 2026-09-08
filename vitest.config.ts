import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@examples': path.resolve(__dirname, 'examples')
    }
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['src/renderer/src/test/setup.ts']
  }
})
