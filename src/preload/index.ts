import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Api, MenuAction, RecoveryRecord, SaveResult, UnsavedChoice } from './index.d'

const api: Api = {
  openFlow: (title?: string) => ipcRenderer.invoke('file:openFlow', title),
  saveFlow: (filePath, content) => ipcRenderer.invoke('file:saveFlow', filePath, content),
  saveFlowAs: (content, defaultName) =>
    ipcRenderer.invoke('file:saveFlowAs', content, defaultName),
  readFlow: (filePath) => ipcRenderer.invoke('file:readFlow', filePath),
  setDirty: (dirty) => {
    ipcRenderer.send('app:setDirty', dirty)
  },
  setDocumentTitle: (title) => {
    ipcRenderer.send('app:setDocumentTitle', title)
  },
  setFilePath: (filePath) => {
    ipcRenderer.send('app:setFilePath', filePath)
  },
  reportSaveResult: (result: SaveResult) => {
    ipcRenderer.send('file:saveResult', result)
  },
  onMenuAction: (cb) => {
    const listener = (_event: IpcRendererEvent, action: MenuAction): void => {
      cb(action)
    }
    ipcRenderer.on('menu:action', listener)
    return () => {
      ipcRenderer.removeListener('menu:action', listener)
    }
  },
  onOpenPath: (cb) => {
    const listener = (_event: IpcRendererEvent, filePath: string): void => {
      if (typeof filePath === 'string' && filePath.length > 0) {
        cb(filePath)
      }
    }
    ipcRenderer.on('file:openFromOs', listener)
    return () => {
      ipcRenderer.removeListener('file:openFromOs', listener)
    }
  },
  confirmUnsaved: (message) =>
    ipcRenderer.invoke('file:confirmUnsaved', message) as Promise<UnsavedChoice>,
  getRecentFiles: () => ipcRenderer.invoke('file:getRecentFiles'),
  writeRecovery: (record: RecoveryRecord) => ipcRenderer.invoke('recovery:write', record),
  readRecovery: () => ipcRenderer.invoke('recovery:read') as Promise<RecoveryRecord | null>,
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
