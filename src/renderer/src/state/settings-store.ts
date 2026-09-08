import { create } from 'zustand'

export const SETTINGS_STORAGE_KEY = 'orchestrator.settings'
export const AUTOSAVE_INTERVALS = [30, 60, 120, 300] as const
export type AutosaveIntervalSec = (typeof AUTOSAVE_INTERVALS)[number]

const DEFAULT_INTERVAL: AutosaveIntervalSec = 60

interface SettingsState {
  autosaveEnabled: boolean
  autosaveIntervalSec: AutosaveIntervalSec
  /** 最近一次自动保存成功时间，不持久化。 */
  lastAutosaveAt: number | null
  setAutosaveEnabled: (enabled: boolean) => void
  setAutosaveIntervalSec: (seconds: AutosaveIntervalSec) => void
  setLastAutosaveAt: (at: number | null) => void
}

function isInterval(value: unknown): value is AutosaveIntervalSec {
  return typeof value === 'number' && (AUTOSAVE_INTERVALS as readonly number[]).includes(value)
}

function readPersisted(): Pick<SettingsState, 'autosaveEnabled' | 'autosaveIntervalSec'> {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return { autosaveEnabled: true, autosaveIntervalSec: DEFAULT_INTERVAL }
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return { autosaveEnabled: true, autosaveIntervalSec: DEFAULT_INTERVAL }
    }
    const record = parsed as Record<string, unknown>
    return {
      autosaveEnabled: record.autosaveEnabled !== false,
      autosaveIntervalSec: isInterval(record.autosaveIntervalSec)
        ? record.autosaveIntervalSec
        : DEFAULT_INTERVAL
    }
  } catch {
    return { autosaveEnabled: true, autosaveIntervalSec: DEFAULT_INTERVAL }
  }
}

function persist(autosaveEnabled: boolean, autosaveIntervalSec: AutosaveIntervalSec): void {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ autosaveEnabled, autosaveIntervalSec })
    )
  } catch {
    /* 配额或隐私模式：忽略 */
  }
}

const initial = readPersisted()

export const useSettingsStore = create<SettingsState>((set) => ({
  autosaveEnabled: initial.autosaveEnabled,
  autosaveIntervalSec: initial.autosaveIntervalSec,
  lastAutosaveAt: null,
  setAutosaveEnabled: (enabled) =>
    set((state) => {
      persist(enabled, state.autosaveIntervalSec)
      return { autosaveEnabled: enabled }
    }),
  setAutosaveIntervalSec: (seconds) =>
    set((state) => {
      persist(state.autosaveEnabled, seconds)
      return { autosaveIntervalSec: seconds }
    }),
  setLastAutosaveAt: (at) => set({ lastAutosaveAt: at })
}))

/** 测试用：恢复默认且不写盘。 */
export function resetSettingsStore(): void {
  useSettingsStore.setState({
    autosaveEnabled: true,
    autosaveIntervalSec: DEFAULT_INTERVAL,
    lastAutosaveAt: null
  })
}
