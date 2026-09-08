import { describe, expect, it, vi } from 'vitest'
import { resolveBrowserShortcut } from '@/app/use-app-shortcuts'
import * as textTarget from '@/ui/is-text-input-target'

function keyEvent(init: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  target?: EventTarget | null
}): KeyboardEvent {
  return {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    target: init.target ?? null
  } as KeyboardEvent
}

describe('resolveBrowserShortcut', () => {
  it('maps file and edit accelerators', () => {
    expect(resolveBrowserShortcut(keyEvent({ key: 's', ctrlKey: true }))).toBe('save')
    expect(resolveBrowserShortcut(keyEvent({ key: 's', ctrlKey: true, shiftKey: true }))).toBe('saveAs')
    expect(resolveBrowserShortcut(keyEvent({ key: 'i', ctrlKey: true }))).toBe('importJson')
    expect(resolveBrowserShortcut(keyEvent({ key: 'z', ctrlKey: true }))).toBe('undo')
    expect(resolveBrowserShortcut(keyEvent({ key: 'z', metaKey: true }))).toBe('undo')
    expect(resolveBrowserShortcut(keyEvent({ key: 'y', ctrlKey: true }))).toBe('redo')
    expect(resolveBrowserShortcut(keyEvent({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(resolveBrowserShortcut(keyEvent({ key: 'c', ctrlKey: true }))).toBe('copy')
    expect(resolveBrowserShortcut(keyEvent({ key: 'v', ctrlKey: true }))).toBe('paste')
    expect(resolveBrowserShortcut(keyEvent({ key: 'd', ctrlKey: true }))).toBe('duplicate')
    expect(resolveBrowserShortcut(keyEvent({ key: 'Delete' }))).toBe('delete')
    expect(resolveBrowserShortcut(keyEvent({ key: 'Backspace' }))).toBe('delete')
  })

  it('does not take over edit keys inside a text field', () => {
    const spy = vi.spyOn(textTarget, 'isTextInputTarget').mockReturnValue(true)
    expect(resolveBrowserShortcut(keyEvent({ key: 'z', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'Delete' }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'n', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'o', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'i', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 's', ctrlKey: true }))).toBe('save')
    spy.mockRestore()
  })
})
