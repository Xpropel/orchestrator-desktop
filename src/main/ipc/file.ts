import { basename } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, type IpcMain } from 'electron'
import { allowPath, isPathAllowed, PATH_NOT_ALLOWED } from '../security/allowed-paths'
import { addRecentFile, getRecentFiles, seedAllowedPaths } from './recent'
import { promptUnsaved } from '../window/unsaved-dialog'

const FLOW_FILTERS: Electron.FileFilter[] = [
  { name: 'Flow JSON', extensions: ['flow.json', 'json'] },
  { name: 'JSON', extensions: ['json'] },
  { name: 'All Files', extensions: ['*'] }
]

export function registerFileIpc(ipc: IpcMain): void {
  seedAllowedPaths(getRecentFiles())

  ipc.handle('file:openFlow', async (event, title?: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: typeof title === 'string' && title.length > 0 ? title : '打开流程',
      properties: ['openFile'],
      filters: FLOW_FILTERS
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    allowPath(filePath)
    const content = await readFile(filePath, 'utf8')
    addRecentFile(filePath)
    return { filePath, content }
  })

  ipc.handle('file:readFlow', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return null
    }
    if (!isPathAllowed(filePath)) {
      throw new Error(PATH_NOT_ALLOWED)
    }
    try {
      const content = await readFile(filePath, 'utf8')
      addRecentFile(filePath)
      return { filePath, content }
    } catch {
      return null
    }
  })

  ipc.handle('file:saveFlow', async (_event, filePath: unknown, content: unknown) => {
    if (typeof filePath !== 'string' || typeof content !== 'string') {
      throw new Error('file:saveFlow expects (filePath: string, content: string)')
    }
    if (!isPathAllowed(filePath)) {
      throw new Error(PATH_NOT_ALLOWED)
    }
    await writeFile(filePath, content, 'utf8')
    addRecentFile(filePath)
  })

  ipc.handle('file:saveFlowAs', async (event, content: unknown, defaultName?: unknown) => {
    if (typeof content !== 'string') {
      throw new Error('file:saveFlowAs expects content: string')
    }
    if (!app.isPackaged) {
      const auto = process.env.ORCH_AUTO_SAVE_DIALOG
      if (auto === 'cancel') {
        return null
      }
      if (auto && auto.length > 0) {
        allowPath(auto)
        await writeFile(auto, content, 'utf8')
        addRecentFile(auto)
        return auto
      }
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const rawName = typeof defaultName === 'string' ? defaultName : 'untitled.flow.json'
    const options: Electron.SaveDialogOptions = {
      title: '流程另存为',
      defaultPath: basename(rawName) || 'untitled.flow.json',
      filters: FLOW_FILTERS
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return null
    }

    allowPath(result.filePath)
    await writeFile(result.filePath, content, 'utf8')
    addRecentFile(result.filePath)
    return result.filePath
  })

  ipc.handle('file:getRecentFiles', async () => getRecentFiles())

  ipc.handle('file:confirmUnsaved', async (event, message: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return promptUnsaved(win, typeof message === 'string' ? message : undefined)
  })
}
