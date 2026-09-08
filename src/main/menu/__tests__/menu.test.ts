import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.1.3'
  },
  dialog: { showMessageBox: vi.fn() },
  Menu: { buildFromTemplate: (template: unknown) => template },
  shell: { openExternal: vi.fn() }
}))

import { applicationMenuTemplate } from '../index'

function labelsOf(template: ReturnType<typeof applicationMenuTemplate>): string[] {
  return template.map((item) => String(item.label ?? item.role ?? ''))
}

describe('applicationMenuTemplate', () => {
  it('puts the app / window menus on macOS and uses Shift+Z as redo', () => {
    const template = applicationMenuTemplate(() => undefined, [], 'darwin')
    expect(labelsOf(template)).toEqual(['Orchestrator Desktop', '文件', '编辑', '视图', '窗口', '帮助'])
    const fileMenu = template[1]?.submenu
    expect(Array.isArray(fileMenu)).toBe(true)
    if (!Array.isArray(fileMenu)) {
      return
    }
    expect(fileMenu.some((item) => item.role === 'recentDocuments')).toBe(true)
    expect(fileMenu.some((item) => item.role === 'close')).toBe(true)

    const editMenu = template[2]?.submenu
    expect(Array.isArray(editMenu)).toBe(true)
    if (!Array.isArray(editMenu)) {
      return
    }
    const visibleRedo = editMenu.find((item) => item.label === '重做' && item.visible !== false)
    expect(visibleRedo?.accelerator).toBe('CommandOrControl+Shift+Z')
    expect(editMenu.some((item) => item.accelerator === 'Backspace')).toBe(true)
  })

  it('keeps the Windows file/help layout', () => {
    const template = applicationMenuTemplate(() => undefined, [], 'win32')
    expect(labelsOf(template)).toEqual(['文件', '编辑', '视图', '帮助'])
    const fileMenu = template[0]?.submenu
    expect(Array.isArray(fileMenu)).toBe(true)
    if (!Array.isArray(fileMenu)) {
      return
    }
    expect(fileMenu.some((item) => item.role === 'quit')).toBe(true)
    expect(fileMenu.some((item) => item.role === 'recentDocuments')).toBe(false)
  })
})
