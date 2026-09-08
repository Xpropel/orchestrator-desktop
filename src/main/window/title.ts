import { BrowserWindow } from 'electron'
import { appState, windowTitle } from './app-state'

export function applyTitle(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return
  }
  win.setTitle(windowTitle())
  win.setDocumentEdited(appState.dirty)
  if (appState.filePath.length > 0) {
    win.setRepresentedFilename(appState.filePath)
  } else {
    win.setRepresentedFilename('')
  }
}
