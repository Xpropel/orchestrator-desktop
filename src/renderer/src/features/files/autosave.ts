import * as fileActions from '@/features/files/file-actions'
import { useFlowStore } from '@/state/flow-store'
import { useSettingsStore } from '@/state/settings-store'
import { useUiStore } from '@/state/ui-store'

let failureToasted = false

export function resetAutosaveFailureFlag(): void {
  failureToasted = false
}

function notifyFailure(message: string): void {
  if (failureToasted) return
  failureToasted = true
  useUiStore.getState().showToast(`自动保存失败：${message}`)
}

/** 到点检查：仅在已命名、脏、且开关打开时静默写盘。 */
export async function tickAutosave(
  save: (options?: { silent?: boolean }) => Promise<boolean> = (options) => fileActions.saveFlow(options)
): Promise<void> {
  const { autosaveEnabled } = useSettingsStore.getState()
  const { dirty, filePath } = useFlowStore.getState()
  if (!autosaveEnabled || !dirty || !filePath) {
    return
  }
  try {
    const ok = await save({ silent: true })
    if (!ok) {
      notifyFailure('写入未完成')
      return
    }
    failureToasted = false
    useSettingsStore.getState().setLastAutosaveAt(Date.now())
  } catch (error) {
    notifyFailure(error instanceof Error ? error.message : '写入未完成')
  }
}

/** 按当前间隔挂定时器；开关或间隔变化时重建。 */
export function subscribeAutosave(): () => void {
  let timer: ReturnType<typeof setInterval> | undefined

  const arm = (): void => {
    if (timer !== undefined) {
      globalThis.clearInterval(timer)
      timer = undefined
    }
    const { autosaveEnabled, autosaveIntervalSec } = useSettingsStore.getState()
    if (!autosaveEnabled) {
      return
    }
    timer = globalThis.setInterval(() => {
      void tickAutosave()
    }, autosaveIntervalSec * 1000)
  }

  arm()

  const unsubSettings = useSettingsStore.subscribe((state, prev) => {
    if (
      state.autosaveEnabled === prev.autosaveEnabled &&
      state.autosaveIntervalSec === prev.autosaveIntervalSec
    ) {
      return
    }
    failureToasted = false
    arm()
  })

  const unsubFlow = useFlowStore.subscribe((state, prev) => {
    if (state.filePath === prev.filePath) {
      return
    }
    failureToasted = false
    useSettingsStore.getState().setLastAutosaveAt(null)
  })

  return () => {
    if (timer !== undefined) {
      globalThis.clearInterval(timer)
    }
    unsubSettings()
    unsubFlow()
  }
}
