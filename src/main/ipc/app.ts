import { BrowserWindow, type IpcMain } from 'electron'
import { appState } from '../window/app-state'
import { isSaveResult, reportRendererSaveResult } from '../window/close-guard'
import { applyTitle } from '../window/title'

export function registerAppIpc(ipc: IpcMain): void {
  ipc.on('app:setDirty', (event, dirty: unknown) => {
    appState.dirty = Boolean(dirty)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      applyTitle(win)
    }
  })

  ipc.on('app:setDocumentTitle', (event, title: unknown) => {
    appState.documentTitle = typeof title === 'string' ? title.trim() : ''
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      applyTitle(win)
    }
  })

  ipc.on('app:setFilePath', (event, filePath: unknown) => {
    appState.filePath = typeof filePath === 'string' ? filePath : ''
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      applyTitle(win)
    }
  })

  ipc.on('file:saveResult', (event, result: unknown) => {
    if (!isSaveResult(result)) {
      return
    }
    if (result === 'saved') {
      appState.dirty = false
    }
    reportRendererSaveResult(result)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      applyTitle(win)
    }
  })
}
