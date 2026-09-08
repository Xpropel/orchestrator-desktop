import { describe, expect, it, vi } from 'vitest'
import { initTheme } from '@/app/theme'
import { useThemeStore } from '@/state/theme-store'

describe('initTheme', () => {
  it('does not subscribe twice on a second call', () => {
    const spy = vi.spyOn(useThemeStore, 'subscribe')
    initTheme()
    const afterFirst = spy.mock.calls.length
    initTheme()
    expect(spy.mock.calls.length).toBe(afterFirst)
    spy.mockRestore()
  })
})
