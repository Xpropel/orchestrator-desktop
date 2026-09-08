import {
  ACCENT_HEX,
  ACCENT_PRESETS,
  useThemeStore,
  type AccentPreset,
  type ThemeMode
} from '@/state/theme-store'

const MODE_KEY = 'orchestrator.theme.mode'
const ACCENT_KEY = 'orchestrator.theme.accent'

function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(MODE_KEY)
    return value === 'light' || value === 'dark' ? value : 'dark'
  } catch {
    return 'dark'
  }
}

function readStoredAccent(): AccentPreset {
  try {
    const value = localStorage.getItem(ACCENT_KEY)
    return ACCENT_PRESETS.includes(value as AccentPreset) ? (value as AccentPreset) : 'blue'
  } catch {
    return 'blue'
  }
}

function applyTheme(mode: ThemeMode, accent: AccentPreset): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = mode
  root.dataset.accent = accent
  root.style.setProperty('--accent', ACCENT_HEX[accent][mode])
}

function persistTheme(mode: ThemeMode, accent: AccentPreset): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
    localStorage.setItem(ACCENT_KEY, accent)
  } catch {
    /* ignore quota / private mode */
  }
}

let subscribed = false

export function initTheme(): { mode: ThemeMode; accent: AccentPreset } {
  const mode = readStoredMode()
  const accent = readStoredAccent()
  applyTheme(mode, accent)
  useThemeStore.setState({ mode, accent })
  if (!subscribed) {
    subscribed = true
    useThemeStore.subscribe((state) => {
      persistTheme(state.mode, state.accent)
      applyTheme(state.mode, state.accent)
    })
  }
  return { mode, accent }
}
