import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { cspPlugin } from './scripts/csp-plugin'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        // 内置示例目录；用别名而非相对路径，文件搬家时不会悄悄失效。
        '@examples': resolve('examples'),
        '@private': resolve('private')
      }
    },
    plugins: [
      react(),
      cspPlugin(() => Boolean(process.env.ELECTRON_RENDERER_URL))
    ]
  }
})
