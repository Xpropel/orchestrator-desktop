import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import type { MenuAction } from '../../preload/index.d'
import { attachNavigationGuard, attachWindowOpenHandler } from '../security/navigation'
import { APP_TITLE } from './app-state'
import { attachCloseGuard } from './close-guard'

function resolvePreloadPath(): string {
  const preloadJs = join(__dirname, '../preload/index.js')
  if (existsSync(preloadJs)) {
    return preloadJs
  }
  return join(__dirname, '../preload/index.mjs')
}

export function sendMenuAction(action: MenuAction): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu:action', action)
}

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#0d1117',
    title: APP_TITLE,
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  attachWindowOpenHandler(mainWindow.webContents)
  attachNavigationGuard(mainWindow.webContents)
  attachCloseGuard(mainWindow)

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
