import { app, shell, type WebContents } from 'electron'

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
    try {
      const path = decodeURIComponent(new URL(url).pathname).replace(/\\/g, '/')
      return path.endsWith('/renderer/index.html') || path.endsWith('/index.html')
    } catch {
      return false
    }
  }
  return false
}

export function canOpenExternal(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    return (
      !app.isPackaged &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    )
  } catch {
    return false
  }
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
