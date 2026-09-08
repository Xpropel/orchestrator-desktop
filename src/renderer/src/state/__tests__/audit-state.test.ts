import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { graphToDocument } from '@/core/dsl'
import { createOperatorNode } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import type { FlowNode } from '@/core/types'
import { flushFormHistory } from '../history-slice'
import { useFlowStore } from '../flow-store'
import { selectStableNode, shallowStableNodeEqual } from '../select-node'

beforeAll(() => {
  loadLibrary()
})

function agentNode(id = 'agent:test0001', name = 'agent_1'): FlowNode {
  return {
    id,
    type: 'taskNode',
    position: { x: 320, y: 240 },
    data: {
      label: 'agent',
      name,
      form: { prompt: '', model: '', temperature: 0.7 }
    }
  }
}

describe('audit-state', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
  })

  afterEach(() => {
    flushFormHistory()
    vi.useRealTimers()
  })

  it('does not dirty or record history on the first dimensions change (resizing:false + setAttributes)', () => {
    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'dimensions',
        dimensions: { width: 140, height: 44 },
        resizing: false,
        setAttributes: true
      }
    ])
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().historyPast.length).toBe(past)
    expect(useFlowStore.getState().nodes[0]?.width).toBeUndefined()
  })

  it('records resize-end after the node already has a size, and undo restores width/height/style', () => {
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'dimensions',
        dimensions: { width: 140, height: 44 },
        resizing: true,
        setAttributes: true
      }
    ])
    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'dimensions',
        dimensions: { width: 220, height: 90 },
        resizing: false,
        setAttributes: true
      }
    ])
    expect(useFlowStore.getState().historyPast.length).toBe(past + 1)
    expect(useFlowStore.getState().nodes[0]?.width).toBe(220)
    expect(useFlowStore.getState().nodes[0]?.height).toBe(90)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes[0]?.width).toBeUndefined()
    expect(useFlowStore.getState().dirty).toBe(false)
  })

  it('does not push history for selection or drag-in-progress', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([{ id: created.id, type: 'select', selected: true }])
    useFlowStore.getState().onNodesChange([
      { id: created.id, type: 'position', position: { x: 10, y: 10 }, dragging: true }
    ])
    expect(useFlowStore.getState().historyPast.length).toBe(past)
  })

  it('keeps history snapshots structurally cloned under setAutoFreeze(false)', () => {
    const baseline = useFlowStore.getState().historyPast[0]
    expect(baseline).toBeDefined()
    const live = useFlowStore.getState().nodes[0]
    expect(live).toBeDefined()
    if (!live || !baseline) return
    live.position.x = 999
    expect(baseline.nodes[0]?.position.x).not.toBe(999)
    live.position.x = 80
  })

  it('clears redo on a new action and bounds history', () => {
    useFlowStore.getState().addNode(agentNode('agent:a'))
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().historyFuture.length).toBeGreaterThan(0)
    useFlowStore.getState().addNode(agentNode('agent:b'))
    expect(useFlowStore.getState().historyFuture).toHaveLength(0)

    for (let index = 0; index < 60; index += 1) {
      useFlowStore.getState().setTitle(`T${index}`)
    }
    expect(useFlowStore.getState().historyPast.length).toBeLessThanOrEqual(51)
  })

  it('undo restores parentId, globals, title, and outgoing edge order', () => {
    const box = createOperatorNode('foreach', { x: 100, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = agentNode()
    useFlowStore.getState().addNode(task)
    useFlowStore.getState().onNodesChange([
      { id: task.id, type: 'position', position: { x: 110, y: 90 }, dragging: false }
    ])
    useFlowStore.getState().setNodeParent(task.id, box.id, { x: 12, y: 18 })
    expect(useFlowStore.getState().nodes.find((node) => node.id === task.id)?.parentId).toBe(box.id)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes.find((node) => node.id === task.id)?.parentId).toBeUndefined()

    useFlowStore.getState().setGlobals({ custom: { token: 'z' } })
    useFlowStore.getState().setTitle('Named')
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().title).not.toBe('Named')
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().globals).toEqual({})

    const t1 = createOperatorNode('agent', { x: 300, y: 80 }, useFlowStore.getState().nodes)
    const t2 = createOperatorNode('agent', { x: 300, y: 160 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(t1)
    useFlowStore.getState().addNode(t2)
    useFlowStore.getState().onConnect({
      source: 'start',
      sourceHandle: 'start#new',
      target: t1.id,
      targetHandle: 'end'
    })
    useFlowStore.getState().onConnect({
      source: 'start',
      sourceHandle: 'start#new',
      target: t2.id,
      targetHandle: 'end'
    })
    const second = useFlowStore.getState().edges[1]
    expect(second).toBeDefined()
    useFlowStore.getState().moveOutgoingEdge(second!.id, 0)
    expect(useFlowStore.getState().edges.map((edge) => edge.target)).toEqual([t2.id, t1.id])
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().edges.map((edge) => edge.target)).toEqual([t1.id, t2.id])
  })

  it('rewrites nested form references and escapes regex-special names', () => {
    const source = agentNode('agent:src0001', 'A+B')
    source.data.form = { prompt: '' }
    const sink = agentNode('agent:sink0001', 'sink')
    sink.data.form = {
      prompt: 'see {{A+B.text}}',
      cases: [{ id: 'c1', expression: '{{A+B.json}}' }],
      headers: [{ key: 'h', value: '{{A+B.session}}' }],
      nested: { map: { a: '{{A+B.text}}' } },
      list: ['{{A+B.text}}', '{{Keep.x}}']
    }
    useFlowStore.getState().addNode(source)
    useFlowStore.getState().addNode(sink)
    useFlowStore.getState().updateNodeData(source.id, { name: 'Renamed' })
    const form = useFlowStore.getState().nodes.find((node) => node.id === sink.id)?.data.form as Record<
      string,
      unknown
    >
    expect(form.prompt).toBe('see {{Renamed.text}}')
    expect((form.cases as Array<{ expression: string }>)[0]?.expression).toBe('{{Renamed.json}}')
    expect((form.headers as Array<{ value: string }>)[0]?.value).toBe('{{Renamed.session}}')
    expect((form.nested as { map: { a: string } }).map.a).toBe('{{Renamed.text}}')
    expect(form.list).toEqual(['{{Renamed.text}}', '{{Keep.x}}'])
  })

  it('rejects a rename onto an existing name and leaves references intact', () => {
    const source = agentNode('agent:src0001', 'agent_1')
    const sink = agentNode('agent:sink0001', 'agent_2')
    sink.data.form = { prompt: '{{agent_1.text}}' }
    useFlowStore.getState().addNode(source)
    useFlowStore.getState().addNode(sink)
    const revision = useFlowStore.getState().revision
    useFlowStore.getState().updateNodeData(source.id, { name: 'agent_2' })
    expect(useFlowStore.getState().nodes.find((node) => node.id === source.id)?.data.name).toBe('agent_1')
    expect(useFlowStore.getState().nodes.find((node) => node.id === sink.id)?.data.form.prompt).toBe(
      '{{agent_1.text}}'
    )
    expect(useFlowStore.getState().revision).toBeGreaterThan(revision)
  })

  it('rejects names that invalidNodeNameReason flags (. { } and surrounding space)', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    const revision = useFlowStore.getState().revision
    useFlowStore.getState().updateNodeData(created.id, { name: 'foo.bar' })
    expect(useFlowStore.getState().nodes.find((node) => node.id === created.id)?.data.name).toBe('agent_1')
    useFlowStore.getState().updateNodeData(created.id, { name: 'foo{x}' })
    expect(useFlowStore.getState().nodes.find((node) => node.id === created.id)?.data.name).toBe('agent_1')
    useFlowStore.getState().updateNodeData(created.id, { name: ' agent_1' })
    expect(useFlowStore.getState().nodes.find((node) => node.id === created.id)?.data.name).toBe('agent_1')
    expect(useFlowStore.getState().revision).toBeGreaterThan(revision)
  })

  it('removeSelected deletes every selected node and edge in one history entry', () => {
    const a = createOperatorNode('agent', { x: 300, y: 80 }, useFlowStore.getState().nodes)
    const b = createOperatorNode('message', { x: 300, y: 160 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(a)
    useFlowStore.getState().addNode(b)
    useFlowStore.getState().onConnect({
      source: 'start',
      target: a.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    useFlowStore.getState().onConnect({
      source: a.id,
      target: b.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    const keepEdge = useFlowStore.getState().edges.find((edge) => edge.source === 'start')
    const dropEdge = useFlowStore.getState().edges.find((edge) => edge.source === a.id)
    expect(keepEdge && dropEdge).toBeTruthy()
    useFlowStore.getState().selectNode(a.id)
    useFlowStore.getState().selectNode(b.id, { exclusive: false })
    if (dropEdge) {
      useFlowStore.getState().onEdgesChange([{ id: dropEdge.id, type: 'select', selected: true }])
    }
    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().removeSelected()
    expect(useFlowStore.getState().historyPast.length).toBe(past + 1)
    expect(useFlowStore.getState().nodes.some((node) => node.id === a.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === b.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
    expect(useFlowStore.getState().edges.some((edge) => edge.id === keepEdge?.id)).toBe(false)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes.some((node) => node.id === a.id)).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.id === b.id)).toBe(true)
  })

  it('removeSelected keeps protected start/loop-start and cascades a selected container', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const inner = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    useFlowStore.getState().addNode(inner)
    useFlowStore.getState().selectNode('start', { exclusive: true })
    useFlowStore.getState().selectNode(box.id, { exclusive: false })
    useFlowStore.getState().selectNode(`${box.id}:start`, { exclusive: false })
    useFlowStore.getState().removeSelected()
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.id === box.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === inner.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === `${box.id}:start`)).toBe(false)
  })

  it('removeSelected drops a selected edge without deleting unselected nodes', () => {
    const a = createOperatorNode('agent', { x: 300, y: 80 }, useFlowStore.getState().nodes)
    const b = createOperatorNode('message', { x: 300, y: 160 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(a)
    useFlowStore.getState().addNode(b)
    useFlowStore.getState().onConnect({
      source: a.id,
      target: b.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    const edgeId = useFlowStore.getState().edges.find((edge) => edge.source === a.id)?.id
    expect(edgeId).toBeTruthy()
    useFlowStore.getState().selectNode(null)
    if (edgeId) {
      useFlowStore.getState().onEdgesChange([{ id: edgeId, type: 'select', selected: true }])
    }
    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().removeSelected()
    expect(useFlowStore.getState().historyPast.length).toBe(past + 1)
    expect(useFlowStore.getState().nodes.some((node) => node.id === a.id)).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.id === b.id)).toBe(true)
    expect(useFlowStore.getState().edges.some((edge) => edge.id === edgeId)).toBe(false)
  })

  it('paste and container delete each push one history entry; RF edge-remove of gone edges does not', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    useFlowStore.getState().addNode(task)
    useFlowStore.getState().onConnect({
      source: `${box.id}:start`,
      target: task.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    const edgeId = useFlowStore.getState().edges[0]?.id
    useFlowStore.getState().selectNode(box.id)
    useFlowStore.getState().copySelected()
    const beforePaste = useFlowStore.getState().historyPast.length
    useFlowStore.getState().pasteClipboard()
    expect(useFlowStore.getState().historyPast.length).toBe(beforePaste + 1)

    const beforeRemove = useFlowStore.getState().historyPast.length
    useFlowStore.getState().removeNode(box.id)
    expect(useFlowStore.getState().historyPast.length).toBe(beforeRemove + 1)
    expect(useFlowStore.getState().nodes.some((node) => node.id === task.id)).toBe(false)
    const afterRemove = useFlowStore.getState().historyPast.length
    if (edgeId) {
      useFlowStore.getState().onEdgesChange([{ id: edgeId, type: 'remove' }])
    }
    expect(useFlowStore.getState().historyPast.length).toBe(afterRemove)
  })

  it('does not remove the last start or a loop-start via store remove or RF changes', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    useFlowStore.getState().removeNode('start')
    useFlowStore.getState().removeNode(`${box.id}:start`)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.id === `${box.id}:start`)).toBe(true)
    useFlowStore.getState().onNodesChange([
      { id: 'start', type: 'remove' },
      { id: `${box.id}:start`, type: 'remove' }
    ])
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.id === `${box.id}:start`)).toBe(true)
  })

  it('bumps revision on undo so DebouncedInput keys remount, and clears dirty when back at saved', () => {
    useFlowStore.getState().markSaved('C:/tmp/audit.flow.json')
    const revision = useFlowStore.getState().revision
    useFlowStore.getState().addNode(agentNode())
    expect(useFlowStore.getState().dirty).toBe(true)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().revision).toBeGreaterThan(revision)
    expect(useFlowStore.getState().dirty).toBe(false)
  })

  it('keeps savedSnapshotKey semantics: measure after markUnsaved stays dirty', () => {
    const { nodes, edges, title, globals } = useFlowStore.getState()
    useFlowStore.getState().loadDocument(graphToDocument(nodes, edges, title, globals), null)
    useFlowStore.getState().markUnsaved()
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'dimensions',
        dimensions: { width: 140, height: 44 },
        resizing: false,
        setAttributes: true
      }
    ])
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().savedSnapshotKey).toBe('')
  })

  it('setNodeParent drops cross-container edges and keeps container/sibling edges in one history step', () => {
    const box = createOperatorNode('foreach', { x: 100, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const sibling = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    useFlowStore.getState().addNode(sibling)
    const outsider = createOperatorNode('message', { x: 520, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(outsider)
    const task = agentNode()
    useFlowStore.getState().addNode(task)

    useFlowStore.getState().onConnect({
      source: 'start',
      target: task.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    useFlowStore.getState().onConnect({
      source: 'start',
      target: box.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    useFlowStore.getState().onConnect({
      source: box.id,
      target: task.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    useFlowStore.getState().onConnect({
      source: task.id,
      target: outsider.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })
    useFlowStore.getState().onConnect({
      source: `${box.id}:start`,
      target: sibling.id,
      sourceHandle: 'start',
      targetHandle: 'end'
    })

    const before = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      { id: task.id, type: 'position', position: { x: 110, y: 90 }, dragging: false }
    ])
    useFlowStore.getState().setNodeParent(task.id, box.id, { x: 10, y: 10 })
    expect(useFlowStore.getState().historyPast.length).toBe(before + 1)
    expect(useFlowStore.getState().nodes.find((node) => node.id === task.id)?.parentId).toBe(box.id)

    const edges = useFlowStore.getState().edges
    expect(edges.some((edge) => edge.source === 'start' && edge.target === task.id)).toBe(false)
    expect(edges.some((edge) => edge.source === task.id && edge.target === outsider.id)).toBe(false)
    expect(edges.some((edge) => edge.source === 'start' && edge.target === box.id)).toBe(true)
    expect(edges.some((edge) => edge.source === box.id && edge.target === task.id)).toBe(true)
    expect(edges.some((edge) => edge.source === `${box.id}:start` && edge.target === sibling.id)).toBe(true)

    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes.find((node) => node.id === task.id)?.parentId).toBeUndefined()
    expect(useFlowStore.getState().edges.some((edge) => edge.source === 'start' && edge.target === task.id)).toBe(
      true
    )
    expect(useFlowStore.getState().edges.some((edge) => edge.source === task.id && edge.target === outsider.id)).toBe(
      true
    )
  })

  it('applies child NodeResizer position+dimensions in parent-relative space', () => {
    const box = createOperatorNode('foreach', { x: 100, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    useFlowStore.getState().addNode(task)

    useFlowStore.getState().onNodesChange([
      { id: task.id, type: 'position', position: { x: 20, y: 30 } },
      {
        id: task.id,
        type: 'dimensions',
        dimensions: { width: 180, height: 80 },
        resizing: true,
        setAttributes: true
      }
    ])
    const mid = useFlowStore.getState().nodes.find((node) => node.id === task.id)
    expect(mid?.parentId).toBe(box.id)
    expect(mid?.position).toEqual({ x: 20, y: 30 })
    expect(mid?.width).toBe(180)
    expect(mid?.height).toBe(80)

    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      { id: task.id, type: 'position', position: { x: 16, y: 24 }, dragging: false },
      {
        id: task.id,
        type: 'dimensions',
        dimensions: { width: 200, height: 88 },
        resizing: false,
        setAttributes: true
      }
    ])
    const end = useFlowStore.getState().nodes.find((node) => node.id === task.id)
    expect(end?.parentId).toBe(box.id)
    expect(end?.position).toEqual({ x: 16, y: 24 })
    expect(end?.width).toBe(200)
    expect(end?.height).toBe(88)
    expect(useFlowStore.getState().historyPast.length).toBe(past + 1)

    useFlowStore.getState().onNodesChange([
      {
        id: task.id,
        type: 'dimensions',
        dimensions: { width: 999, height: 999 },
        resizing: false,
        setAttributes: true
      }
    ])
    expect(useFlowStore.getState().nodes.find((node) => node.id === task.id)?.width).toBe(999)
  })

  it('selectStableNode stays shallow-equal across a position-only change', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    const before = selectStableNode(useFlowStore.getState().nodes, created.id)
    expect(before).toBeDefined()
    useFlowStore.getState().onNodesChange([
      { id: created.id, type: 'position', position: { x: 900, y: 400 }, dragging: true }
    ])
    const after = selectStableNode(useFlowStore.getState().nodes, created.id)
    expect(shallowStableNodeEqual(before, after)).toBe(true)
    expect(after?.data).toBe(before?.data)
    expect(after).not.toHaveProperty('position')
    expect(useFlowStore.getState().nodes.find((node) => node.id === created.id)?.position).toEqual({
      x: 900,
      y: 400
    })
  })
})
