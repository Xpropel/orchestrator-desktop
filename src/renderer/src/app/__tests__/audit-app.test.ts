import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { runMenuAction } from '@/app/menu-actions'
import { committedTitle, flushPendingTitleEdit, registerTitleEditFlush } from '@/app/title-edit'
import { resolveBrowserShortcut } from '@/app/use-app-shortcuts'
import { createOperatorNode } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import { useFlowStore } from '@/state/flow-store'
import { formatWindowTitle } from '@shared/window-title'
import { isEditableInputType } from '@shared/text-input'
import { textFieldMenuBehavior } from '@/ui/text-input-edit'
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

describe('title edit flush', () => {
  it('turns a blank draft into Untitled and flushes once', () => {
    expect(committedTitle('   ')).toBe('Untitled')
    expect(committedTitle('Flow A')).toBe('Flow A')
    const spy = vi.fn()
    registerTitleEditFlush(spy)
    flushPendingTitleEdit()
    expect(spy).toHaveBeenCalledTimes(1)
    registerTitleEditFlush(null)
    flushPendingTitleEdit()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('browser / window title', () => {
  it('includes the dirty marker and product name', () => {
    expect(formatWindowTitle('Untitled', true)).toBe('Untitled * — Orchestrator Desktop')
    expect(formatWindowTitle('Untitled', false)).toBe('Untitled — Orchestrator Desktop')
    expect(formatWindowTitle('', false)).toBe('Orchestrator Desktop')
  })
})

describe('shortcuts vs text fields', () => {
  it('does not steal edit keys inside a text field in browser mode', () => {
    const spy = vi.spyOn(textTarget, 'isTextInputTarget').mockReturnValue(true)
    expect(resolveBrowserShortcut(keyEvent({ key: 'z', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'c', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'v', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'Delete' }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 's', ctrlKey: true }))).toBe('save')
    spy.mockRestore()
  })

  it('does not start new/open/import from a text field; save still works', () => {
    const spy = vi.spyOn(textTarget, 'isTextInputTarget').mockReturnValue(true)
    expect(resolveBrowserShortcut(keyEvent({ key: 'n', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'o', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 'i', ctrlKey: true }))).toBeNull()
    expect(resolveBrowserShortcut(keyEvent({ key: 's', ctrlKey: true, shiftKey: true }))).toBe('saveAs')
    spy.mockRestore()
  })
})

describe('Electron menu action vs typing', () => {
  it('uses native edit for copy/paste/undo/delete and swallows duplicate', () => {
    expect(textFieldMenuBehavior('copy')).toBe('native-edit')
    expect(textFieldMenuBehavior('paste')).toBe('native-edit')
    expect(textFieldMenuBehavior('undo')).toBe('native-edit')
    expect(textFieldMenuBehavior('delete')).toBe('native-edit')
    expect(textFieldMenuBehavior('duplicate')).toBe('swallow')
    expect(textFieldMenuBehavior('save')).toBe('forward')
  })

  it('does not treat range/checkbox inputs as typing targets', () => {
    expect(isEditableInputType('text')).toBe(true)
    expect(isEditableInputType('search')).toBe(true)
    expect(isEditableInputType('range')).toBe(false)
    expect(isEditableInputType('checkbox')).toBe(false)
    expect(isEditableInputType('button')).toBe(false)
  })
})

describe('runMenuAction delete', () => {
  beforeAll(() => {
    loadLibrary()
  })

  beforeEach(() => {
    vi.stubGlobal('document', { activeElement: null })
    useFlowStore.getState().resetToEmpty()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes every selected node, not only selectedNodeId', () => {
    const a = createOperatorNode('agent', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    const b = createOperatorNode('message', { x: 200, y: 160 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(a)
    useFlowStore.getState().addNode(b)
    useFlowStore.getState().selectNode(a.id)
    useFlowStore.getState().selectNode(b.id, { exclusive: false })
    expect(useFlowStore.getState().selectedNodeId).toBe(b.id)
    runMenuAction('delete')
    expect(useFlowStore.getState().nodes.some((node) => node.id === a.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === b.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
  })
})
