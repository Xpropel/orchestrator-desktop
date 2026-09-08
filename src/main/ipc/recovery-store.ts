import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { RecoveryRecord } from '../../preload/index.d'

const MAX_RECOVERY_BYTES = 20 * 1024 * 1024

function recoveryPath(): string {
  return join(app.getPath('userData'), 'recovery.flow.json')
}

export function isRecoveryRecord(value: unknown): value is RecoveryRecord {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.content === 'string' &&
    (record.filePath === null || typeof record.filePath === 'string') &&
    typeof record.savedAt === 'string'
  )
}

let ioChain: Promise<void> = Promise.resolve()

function serializeIo(task: () => Promise<void>): Promise<void> {
  const run = ioChain.then(task, task)
  ioChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export async function writeRecovery(record: RecoveryRecord): Promise<void> {
  return serializeIo(async () => {
    const bytes = Buffer.byteLength(record.content, 'utf8')
    if (bytes > MAX_RECOVERY_BYTES) {
      console.warn(`[recovery] snapshot ${bytes} bytes exceeds ${MAX_RECOVERY_BYTES}, skip write`)
      return
    }
    await writeFile(recoveryPath(), JSON.stringify(record), 'utf8')
  })
}

export async function readRecovery(): Promise<RecoveryRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(recoveryPath(), 'utf8'))
    return isRecoveryRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function clearRecovery(): Promise<void> {
  return serializeIo(async () => {
    await rm(recoveryPath(), { force: true })
  })
}
