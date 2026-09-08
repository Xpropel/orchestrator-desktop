import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'
export type AccentPreset = 'blue' | 'violet' | 'emerald' | 'amber'

export const ACCENT_PRESETS: readonly AccentPreset[] = ['blue', 'violet', 'emerald', 'amber']

export const ACCENT_HEX: Record<AccentPreset, { dark: string; light: string }> = {
  blue: { dark: '#58a6ff', light: '#2563eb' },
  violet: { dark: '#a78bfa', light: '#7c3aed' },
  emerald: { dark: '#34d399', light: '#059669' },
  amber: { dark: '#fbbf24', light: '#d97706' }
}

interface ThemeState {
  mode: ThemeMode
  accent: AccentPreset
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: AccentPreset) => void
  toggleMode: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  accent: 'blue',
  setMode: (mode) => set({ mode }),
  setAccent: (accent) => set({ accent }),
  toggleMode: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark'
    get().setMode(next)
  }
}))
