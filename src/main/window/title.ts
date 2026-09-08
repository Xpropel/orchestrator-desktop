import { BrowserWindow } from 'electron'
import { windowTitle } from './app-state'

export function applyTitle(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return
  }
  win.setTitle(windowTitle())
}
