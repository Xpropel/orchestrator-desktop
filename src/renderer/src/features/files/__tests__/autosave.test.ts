import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOperatorNode } from '@/core/graph'
import * as fileActions from '@/features/files/file-actions'
import { useFlowStore } from '@/state/flow-store'
import { resetSettingsStore, useSettingsStore } from '@/state/settings-store'
import { useUiStore } from '@/state/ui-store'
import { resetAutosaveFailureFlag, subscribeAutosave, tickAutosave } from '../autosave'

function makeDirtyNamedFile(): void {
  useFlowStore.getState().addNode(
    createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes)
  )
  useFlowStore.getState().markSaved('C:/tmp/demo.flow.json')
  useFlowStore.getState().addNode(
    createOperatorNode('message', { x: 40, y: 40 }, useFlowStore.getState().nodes)
  )
}

describe('autosave', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    resetSettingsStore()
    resetAutosaveFailureFlag()
    useUiStore.setState({ toast: null })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetAutosaveFailureFlag()
    resetSettingsStore()
  })

  it('saves only when dirty and filePath exist', async () => {
    const save = vi.fn().mockResolvedValue(true)
    await tickAutosave(save)
    expect(save).not.toHaveBeenCalled()

    useFlowStore.getState().addNode(
      createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes)
    )
    await tickAutosave(save)
    expect(save).not.toHaveBeenCalled()

    makeDirtyNamedFile()
    await tickAutosave(save)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ silent: true })
    expect(useSettingsStore.getState().lastAutosaveAt).toBeTypeOf('number')
  })

  it('does not save unnamed files', async () => {
    const save = vi.fn().mockResolvedValue(true)
    useFlowStore.getState().addNode(
      createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes)
    )
    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().dirty).toBe(true)
    await tickAutosave(save)
    expect(save).not.toHaveBeenCalled()
  })

  it('does not save when autosave is disabled', async () => {
    const save = vi.fn().mockResolvedValue(true)
    makeDirtyNamedFile()
    useSettingsStore.getState().setAutosaveEnabled(false)
    await tickAutosave(save)
    expect(save).not.toHaveBeenCalled()
  })

  it('rebuilds the timer after the interval changes', async () => {
    const save = vi.spyOn(fileActions, 'saveFlow').mockResolvedValue(true)
    vi.useFakeTimers()
    makeDirtyNamedFile()
    const dispose = subscribeAutosave()
    vi.advanceTimersByTime(59_000)
    expect(save).not.toHaveBeenCalled()
    useSettingsStore.getState().setAutosaveIntervalSec(30)
    vi.advanceTimersByTime(29_000)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('toasts a save failure only once', async () => {
    const save = vi.fn().mockRejectedValue(new Error('磁盘已满'))
    const showToast = vi.fn()
    useUiStore.setState({ showToast })
    makeDirtyNamedFile()
    await tickAutosave(save)
    await tickAutosave(save)
    expect(save).toHaveBeenCalledTimes(2)
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('自动保存失败：磁盘已满')
  })
})
