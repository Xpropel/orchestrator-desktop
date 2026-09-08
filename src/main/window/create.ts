import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { EDITABLE_FIELD_JS } from '../../shared/text-input'
import type { MenuAction } from '../../preload/index.d'
import { nativeEditCommand } from '../menu/native-edit'
import { attachNavigationGuard, attachWindowOpenHandler } from '../security/navigation'
import { APP_TITLE } from './app-state'
import { attachCloseGuard } from './close-guard'
import { attachOpenPathFlush } from './open-file'

function resolvePreloadPath(): string {
  const preloadJs = join(__dirname, '../preload/index.js')
  if (existsSync(preloadJs)) {
    return preloadJs
  }
  return join(__dirname, '../preload/index.mjs')
}

function applyNativeEdit(win: BrowserWindow, command: ReturnType<typeof nativeEditCommand>): void {
  if (!command || win.isDestroyed()) {
    return
  }
  switch (command) {
    case 'undo':
      win.webContents.undo()
      return
    case 'redo':
      win.webContents.redo()
      return
    case 'copy':
      win.webContents.copy()
      return
    case 'paste':
      win.webContents.paste()
      return
    case 'delete':
      win.webContents.delete()
  }
}

/**
 * 隐藏菜单栏时加速键仍走这里。复制/粘贴/撤销/删除在文本框内必须用
 * `webContents.copy()` 等原生命令：菜单拦截了按键，渲染进程里的
 * `document.execCommand` 没有用户手势，经常是空操作。
 */
export function sendMenuAction(action: MenuAction): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) {
    return
  }
  const native = nativeEditCommand(action)
  if (!native) {
    win.webContents.send('menu:action', action)
    return
  }
  void win.webContents
    .executeJavaScript(EDITABLE_FIELD_JS)
    .then((inText: unknown) => {
      if (win.isDestroyed()) {
        return
      }
      if (inText === true) {
        applyNativeEdit(win, native)
        return
      }
      win.webContents.send('menu:action', action)
    })
    .catch(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('menu:action', action)
      }
    })
}

function windowChrome(): BrowserWindowConstructorOptions {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 10 },
      acceptFirstMouse: true
    }
  }
  return {
    // Windows：菜单栏默认隐藏（Alt 临时显示）；加速键仍走应用菜单。
    autoHideMenuBar: true
  }
}

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0d1117',
    title: APP_TITLE,
    ...windowChrome(),
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
  attachOpenPathFlush(mainWindow)

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
