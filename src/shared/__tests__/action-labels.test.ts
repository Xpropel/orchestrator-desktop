import { describe, expect, it } from 'vitest'
import { actionShortcut, labeledShortcut } from '../action-labels'
import { foldsPathCase, isMacPlatform } from '../platform'

describe('action shortcuts', () => {
  it('uses Command symbols on macOS and Ctrl on Windows', () => {
    expect(actionShortcut('undo', 'darwin')).toBe('⌘Z')
    expect(actionShortcut('redo', 'darwin')).toBe('⌘⇧Z')
    expect(actionShortcut('delete', 'darwin')).toBe('⌫')
    expect(actionShortcut('undo', 'win32')).toBe('Ctrl+Z')
    expect(actionShortcut('redo', 'win32')).toBe('Ctrl+Y')
    expect(labeledShortcut('copy', 'darwin')).toBe('复制 (⌘C)')
    expect(labeledShortcut('copy', 'win32')).toBe('复制 (Ctrl+C)')
  })
})

describe('platform helpers', () => {
  it('treats macOS as case-insensitive like Windows', () => {
    expect(isMacPlatform('darwin')).toBe(true)
    expect(isMacPlatform('win32')).toBe(false)
    expect(foldsPathCase('darwin')).toBe(true)
    expect(foldsPathCase('win32')).toBe(true)
    expect(foldsPathCase('linux')).toBe(false)
  })
})
