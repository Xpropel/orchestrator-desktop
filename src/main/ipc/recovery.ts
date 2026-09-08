import type { IpcMain } from 'electron'
import type { RecoveryRecord } from '../../preload/index.d'
import { appState } from '../window/app-state'
import { clearRecovery, isRecoveryRecord, readRecovery, writeRecovery } from './recovery-store'

/** 干净保存后迟到的快照不得写回，否则下次启动会误报「未保存」。 */
export async function persistRecoveryRecord(record: RecoveryRecord): Promise<void> {
  if (!appState.dirty) {
    return
  }
  await writeRecovery(record)
  if (!appState.dirty) {
    await clearRecovery()
  }
}

export function registerRecoveryIpc(ipc: IpcMain): void {
  ipc.handle('recovery:write', async (_event, record: unknown) => {
    if (!isRecoveryRecord(record)) {
      throw new Error('recovery:write expects { content, filePath, savedAt }')
    }
    await persistRecoveryRecord(record)
  })
  ipc.handle('recovery:read', async () => readRecovery())
  ipc.handle('recovery:clear', async () => clearRecovery())
}
