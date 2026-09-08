import { beforeEach, describe, expect, it } from 'vitest'
import { graphToDocument, serializeDocument } from '@/core/dsl'
import { createOperatorNode } from '@/core/graph'
import { useFlowStore } from '@/state/flow-store'
import { loadFlowFromText } from '../file-actions'

describe('loadFlowFromText', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
  })

  it('loads JSON with a null filePath so Save falls back to Save As', () => {
    const extra = createOperatorNode('message', { x: 400, y: 80 }, useFlowStore.getState().nodes)
    extra.data = { ...extra.data, form: { content: 'hello' } }
    const nodes = [...useFlowStore.getState().nodes, extra]
    const json = serializeDocument(graphToDocument(nodes, [], 'FromText', {}))
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, nodes))
    loadFlowFromText(json, null)
    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().title).toBe('FromText')
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'message')).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'agent')).toBe(false)
  })
})
