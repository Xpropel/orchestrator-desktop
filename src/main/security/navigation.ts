import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, shell, type WebContents } from 'electron'
import { normalizePath } from './normalize-path'

/** 打包后唯一允许导航到的渲染页（任意 `…/index.html` 会带上同一套 preload/IPC）。 */
export function defaultRendererIndexPath(): string {
  return join(__dirname, '../renderer/index.html')
}

/** `file:` 导航必须精确等于应用自己的 renderer/index.html，不能只看后缀。 */
export function isAllowedFileNavigation(url: string, rendererIndexFile: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'file:') {
      return false
    }
    return normalizePath(fileURLToPath(parsed)) === normalizePath(rendererIndexFile)
  } catch {
    return false
  }
}

export function isAllowedExternalUrl(url: string, allowLocalHttp: boolean): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    return (
      allowLocalHttp &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    )
  } catch {
    return false
  }
}

export function isAllowedRendererUrl(url: string): boolean {
  const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  if (devUrl) {
    try {
      const allowed = new URL(devUrl)
      const next = new URL(url)
      if (next.origin === allowed.origin) return true
    } catch {
      /* fall through */
    }
  }
  if (url.startsWith('file:')) {
    return isAllowedFileNavigation(url, defaultRendererIndexPath())
  }
  return false
}

export function canOpenExternal(url: string): boolean {
  return isAllowedExternalUrl(url, !app.isPackaged)
}

export function attachNavigationGuard(contents: WebContents): void {
  contents.on('will-navigate', (event) => {
    if (!isAllowedRendererUrl(event.url)) {
      event.preventDefault()
    }
  })
  contents.on('will-redirect', (event) => {
    if (!isAllowedRendererUrl(event.url)) {
      event.preventDefault()
    }
  })
}

export function attachWindowOpenHandler(contents: WebContents): void {
  contents.setWindowOpenHandler((details) => {
    if (canOpenExternal(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })
}
