import { loadFlowFromText, serializeCurrentFlow } from '@/features/files/file-actions'
import { fileApi } from '@/platform/platform'
import { useFlowStore } from '@/state/flow-store'

/** 脏状态下写恢复快照的间隔。 */
export const SNAPSHOT_INTERVAL_MS = 20_000
/** 首次变脏后延迟多久写第一份快照（避免每次击键都写盘）。 */
export const FIRST_SNAPSHOT_DELAY_MS = 3_000

let lastWrittenContent = ''
let restoreInFlight: Promise<'none' | 'restored' | 'discarded' | 'failed'> | null = null

export function resetRecoveryWriteCache(): void {
  lastWrittenContent = ''
}

export function resetRecoveryRestoreGate(): void {
  restoreInFlight = null
}

export async function writeRecoverySnapshot(): Promise<void> {
  const { dirty, filePath } = useFlowStore.getState()
  if (!dirty) {
    return
  }
  const content = serializeCurrentFlow()
  if (content === lastWrittenContent) {
    return
  }
  lastWrittenContent = content
  try {
    await fileApi.writeRecovery({ content, filePath, savedAt: new Date().toISOString() })
  } catch {
    // 恢复快照是尽力而为，不打断编辑。
  }
}

export async function clearRecoverySnapshot(): Promise<void> {
  lastWrittenContent = ''
  try {
    await fileApi.clearRecovery()
  } catch {
    // 同上。
  }
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export type RecoveryUi = {
  confirm: (message: string) => boolean
  alert: (message: string) => void
}

/** 启动时若存在上次未保存的快照，询问是否恢复。恢复后画布标记为脏。 */
export async function restoreRecoveryIfPresent(
  ui: RecoveryUi = {
    confirm: (message) => window.confirm(message),
    alert: (message) => window.alert(message)
  }
): Promise<'none' | 'restored' | 'discarded' | 'failed'> {
  if (restoreInFlight) {
    return restoreInFlight
  }
  restoreInFlight = (async () => {
    const record = await fileApi.readRecovery()
    if (!record) {
      return 'none'
    }
    const where = record.filePath ? `\n文件：${record.filePath}` : '\n（尚未保存到文件）'
    const accepted = ui.confirm(
      `检测到上次未保存的流程（${formatSavedAt(record.savedAt)}）。${where}\n\n是否恢复？选择“取消”将丢弃该快照。`
    )
    if (!accepted) {
      await clearRecoverySnapshot()
      return 'discarded'
    }
    try {
      loadFlowFromText(record.content, record.filePath)
      useFlowStore.getState().markUnsaved()
      lastWrittenContent = record.content
      return 'restored'
    } catch (error) {
      ui.alert(`恢复失败：${error instanceof Error ? error.message : '快照已损坏'}`)
      await clearRecoverySnapshot()
      return 'failed'
    }
  })()
  return restoreInFlight
}

/** 订阅 dirty：3s 后写第一份快照，之后按间隔续写；变干净则清除。 */
export function subscribeDirtyRecovery(): () => void {
  let firstTimer: ReturnType<typeof setTimeout> | null = null
  const interval = globalThis.setInterval(() => {
    void writeRecoverySnapshot()
  }, SNAPSHOT_INTERVAL_MS)

  const armFirstWrite = (): void => {
    if (firstTimer !== null) {
      return
    }
    firstTimer = globalThis.setTimeout(() => {
      firstTimer = null
      void writeRecoverySnapshot()
    }, FIRST_SNAPSHOT_DELAY_MS)
  }

  if (useFlowStore.getState().dirty) {
    armFirstWrite()
  }

  const unsubscribe = useFlowStore.subscribe((state, prev) => {
    if (state.dirty === prev.dirty) {
      return
    }
    if (state.dirty) {
      armFirstWrite()
      return
    }
    if (firstTimer !== null) {
      globalThis.clearTimeout(firstTimer)
      firstTimer = null
    }
    void clearRecoverySnapshot()
  })

  return () => {
    globalThis.clearInterval(interval)
    if (firstTimer !== null) {
      globalThis.clearTimeout(firstTimer)
    }
    unsubscribe()
  }
}
