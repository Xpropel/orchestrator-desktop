import type { IpcMain } from 'electron'
import { clearRecovery, isRecoveryRecord, readRecovery, writeRecovery } from './recovery-store'

export function registerRecoveryIpc(ipc: IpcMain): void {
  ipc.handle('recovery:write', async (_event, record: unknown) => {
    if (!isRecoveryRecord(record)) {
      throw new Error('recovery:write expects { content, filePath, savedAt }')
    }
    await writeRecovery(record)
  })
  ipc.handle('recovery:read', async () => readRecovery())
  ipc.handle('recovery:clear', async () => clearRecovery())
}
