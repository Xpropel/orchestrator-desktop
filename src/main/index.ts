import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { loadExampleManifest } from './ipc/examples'
import { registerAppIpc } from './ipc/app'
import { registerFileIpc } from './ipc/file'
import { registerRecoveryIpc } from './ipc/recovery'
import { createApplicationMenu } from './menu'
import { clearRecovery } from './ipc/recovery-store'
import { applyContentSecurityPolicy } from './security/session-csp'
import { attachNavigationGuard, attachWindowOpenHandler } from './security/navigation'
import { isSmoke, remoteDebugPort } from './window/smoke-env'
import { attachSmokeHooks } from './window/smoke'
import { createWindow, sendMenuAction } from './window/create'

const debugPort = remoteDebugPort()
if (debugPort) {
  app.commandLine.appendSwitch('remote-debugging-port', debugPort)
  app.commandLine.appendSwitch('remote-allow-origins', '*')
}

app.on('web-contents-created', (_event, contents) => {
  attachNavigationGuard(contents)
  attachWindowOpenHandler(contents)
})

app.whenReady().then(async () => {
  applyContentSecurityPolicy()
  registerFileIpc(ipcMain)
  registerRecoveryIpc(ipcMain)
  registerAppIpc(ipcMain)
  Menu.setApplicationMenu(createApplicationMenu(sendMenuAction, await loadExampleManifest()))
  if (isSmoke()) {
    await clearRecovery()
  }
  const win = createWindow()
  if (isSmoke()) {
    attachSmokeHooks(win)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const next = createWindow()
      if (isSmoke()) {
        attachSmokeHooks(next)
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
