import { BrowserWindow } from 'electron'
import { addRecentFile } from '../ipc/recent'
import { allowPath } from '../security/allowed-paths'

const pending: string[] = []

export function isFlowOpenPath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return lower.endsWith('.flow.json') || lower.endsWith('.json')
}

export function flowPathsFromArgv(argv: string[], packaged: boolean): string[] {
  const start = packaged ? 1 : 2
  return argv.slice(start).filter((item) => item.length > 0 && !item.startsWith('-') && isFlowOpenPath(item))
}

export function enqueueOpenPath(filePath: string): void {
  if (!isFlowOpenPath(filePath)) {
    return
  }
  pending.push(filePath)
}

export function takePendingOpenPath(): string | null {
  if (pending.length === 0) {
    return null
  }
  const last = pending[pending.length - 1] ?? null
  pending.length = 0
  return last
}

export function resetOpenPathQueue(): void {
  pending.length = 0
}

function sendOpenPath(win: BrowserWindow, filePath: string): void {
  allowPath(filePath)
  addRecentFile(filePath)
  win.webContents.send('file:openFromOs', filePath)
}

/** Finder / Dock / `open` 丢来的文件：窗口已就绪就立刻交给渲染进程。 */
export function deliverOpenPath(filePath: string): void {
  if (!isFlowOpenPath(filePath)) {
    return
  }
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed() && !win.webContents.isLoadingMainFrame()) {
    sendOpenPath(win, filePath)
    return
  }
  enqueueOpenPath(filePath)
}

export function flushPendingOpenPath(win: BrowserWindow): void {
  const filePath = takePendingOpenPath()
  if (!filePath || win.isDestroyed()) {
    return
  }
  sendOpenPath(win, filePath)
}

export function attachOpenPathFlush(win: BrowserWindow): void {
  win.webContents.on('did-finish-load', () => {
    flushPendingOpenPath(win)
  })
}
