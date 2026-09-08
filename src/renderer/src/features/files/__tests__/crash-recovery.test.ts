import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { graphToDocument, serializeDocument } from '@/core/dsl'
import { createOperatorNode } from '@/core/graph'
import { fileApi } from '@/platform/platform'
import { useFlowStore } from '@/state/flow-store'
import {
  FIRST_SNAPSHOT_DELAY_MS,
  resetRecoveryWriteCache,
  restoreRecoveryIfPresent,
  subscribeDirtyRecovery,
  writeRecoverySnapshot
} from '../crash-recovery'

describe('crash recovery via fileApi', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    resetRecoveryWriteCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetRecoveryWriteCache()
  })

  it('writes a snapshot through fileApi.writeRecovery', async () => {
    const write = vi.spyOn(fileApi, 'writeRecovery').mockResolvedValue(undefined)
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes))
    await writeRecoverySnapshot()
    expect(write).toHaveBeenCalledTimes(1)
    const record = write.mock.calls[0]?.[0]
    expect(record?.filePath).toBeNull()
    expect(record?.content).toContain('"title"')
  })

  it('writes 3s after becoming dirty and clears when dirty goes false', async () => {
    const write = vi.spyOn(fileApi, 'writeRecovery').mockResolvedValue(undefined)
    const clear = vi.spyOn(fileApi, 'clearRecovery').mockResolvedValue(undefined)
    vi.useFakeTimers()
    const dispose = subscribeDirtyRecovery()
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes))
    vi.advanceTimersByTime(FIRST_SNAPSHOT_DELAY_MS - 1)
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    await Promise.resolve()
    expect(write).toHaveBeenCalled()
    useFlowStore.getState().resetToEmpty()
    await Promise.resolve()
    expect(clear).toHaveBeenCalled()
    dispose()
  })

  it('restores through loadFlowFromText + markUnsaved', async () => {
    const { nodes, edges, globals } = useFlowStore.getState()
    const content = serializeDocument(graphToDocument(nodes, edges, 'Recovered', globals))
    vi.spyOn(fileApi, 'readRecovery').mockResolvedValue({
      content,
      filePath: null,
      savedAt: '2026-01-01T00:00:00.000Z'
    })
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes))
    const result = await restoreRecoveryIfPresent({
      confirm: () => true,
      alert: () => undefined
    })
    expect(result).toBe('restored')
    expect(useFlowStore.getState().title).toBe('Recovered')
    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'agent')).toBe(false)
  })

  it('discards via fileApi.clearRecovery when the user declines', async () => {
    const clear = vi.spyOn(fileApi, 'clearRecovery').mockResolvedValue(undefined)
    vi.spyOn(fileApi, 'readRecovery').mockResolvedValue({
      content: '{}',
      filePath: null,
      savedAt: '2026-01-01T00:00:00.000Z'
    })
    const result = await restoreRecoveryIfPresent({
      confirm: () => false,
      alert: () => undefined
    })
    expect(result).toBe('discarded')
    expect(clear).toHaveBeenCalled()
  })
})
