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
import { deliverOpenPath, flowPathsFromArgv } from './window/open-file'
import { APP_TITLE, appState } from './window/app-state'

app.setName(APP_TITLE)

const debugPort = remoteDebugPort()
if (debugPort) {
  app.commandLine.appendSwitch('remote-debugging-port', debugPort)
  app.commandLine.appendSwitch('remote-allow-origins', '*')
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  deliverOpenPath(filePath)
})

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
  for (const filePath of flowPathsFromArgv(process.argv, app.isPackaged)) {
    deliverOpenPath(filePath)
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

app.on('before-quit', () => {
  appState.quitRequested = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
