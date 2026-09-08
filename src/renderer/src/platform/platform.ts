import type { Api, MenuAction, RecoveryRecord, SaveResult, UnsavedChoice } from '../../../preload/index.d'

const RECOVERY_STORAGE_KEY = 'orchestrator.recovery'

function isRecoveryRecord(value: unknown): value is RecoveryRecord {
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

function readRecoveryFromStorage(): RecoveryRecord | null {
  try {
    const raw = window.localStorage.getItem(RECOVERY_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    return isRecoveryRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}
let unsavedConfirm: (message?: string) => Promise<UnsavedChoice> = async () => 'discard'

export function setUnsavedConfirm(handler: (message?: string) => Promise<UnsavedChoice>): void {
  unsavedConfirm = handler
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function fileNameFromPath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath
}

function openFlowInBrowser(): Promise<{ filePath: string; content: string } | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: { filePath: string; content: string } | null): void => {
      if (settled) {
        return
      }
      settled = true
      window.removeEventListener('focus', onWindowFocus)
      resolve(value)
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.flow.json,application/json'
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) {
        finish(null)
        return
      }
      finish({ filePath: file.name, content: await file.text() })
    })
    input.addEventListener('cancel', () => {
      finish(null)
    })

    const onWindowFocus = (): void => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          finish(null)
        }
      }, 400)
    }

    window.addEventListener('focus', onWindowFocus)
    input.click()
  })
}

const browserApi: Api = {
  openFlow: openFlowInBrowser,
  saveFlow: async (filePath, content) => {
    downloadText(fileNameFromPath(filePath), content)
  },
  saveFlowAs: async (content, defaultName) => {
    const name = defaultName ?? 'untitled.flow.json'
    downloadText(name, content)
    return name
  },
  readFlow: async () => null,
  setDirty: () => undefined,
  setDocumentTitle: (title) => {
    document.title = title ? `${title} — Orchestrator` : 'Orchestrator'
  },
  reportSaveResult: (_result: SaveResult) => undefined,
  onMenuAction: (_cb: (action: MenuAction) => void) => () => undefined,
  confirmUnsaved: (message) => unsavedConfirm(message),
  getRecentFiles: async () => [],
  writeRecovery: async (record) => {
    try {
      window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record))
    } catch {
      // 配额不足或隐私模式：静默放弃，恢复只是尽力而为。
    }
  },
  readRecovery: async () => readRecoveryFromStorage(),
  clearRecovery: async () => {
    window.localStorage.removeItem(RECOVERY_STORAGE_KEY)
  },
  platform: 'win32'
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined'
}

function nativeApi(): Api {
  return window.api ?? browserApi
}

/** Electron IPC when available; otherwise browser file input / Blob download. */
export const fileApi: Api = {
  openFlow: (title?: string) => nativeApi().openFlow(title),
  saveFlow: (filePath, content) => nativeApi().saveFlow(filePath, content),
  saveFlowAs: (content, defaultName) => nativeApi().saveFlowAs(content, defaultName),
  readFlow: (filePath) => nativeApi().readFlow(filePath),
  setDirty: (dirty) => nativeApi().setDirty(dirty),
  setDocumentTitle: (title) => nativeApi().setDocumentTitle(title),
  reportSaveResult: (result) => nativeApi().reportSaveResult(result),
  onMenuAction: (cb) => nativeApi().onMenuAction(cb),
  confirmUnsaved: (message) => nativeApi().confirmUnsaved(message),
  getRecentFiles: () => nativeApi().getRecentFiles(),
  writeRecovery: (record) => nativeApi().writeRecovery(record),
  readRecovery: () => nativeApi().readRecovery(),
  clearRecovery: () => nativeApi().clearRecovery(),
  get platform() {
    return window.api?.platform ?? guessBrowserPlatform()
  }
}

function guessBrowserPlatform(): NodeJS.Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('linux')) return 'linux'
  return 'win32'
}
