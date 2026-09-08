import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { graphToDocument } from '@/core/dsl'
import { createOperatorNode, resolveParentAfterDrag } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import type { FlowNode } from '@/core/types'
import { useFlowStore } from '../flow-store'

beforeAll(() => {
  loadLibrary()
})

function agentNode(id = 'agent:test0001'): FlowNode {
  return {
    id,
    type: 'taskNode',
    position: { x: 320, y: 240 },
    data: {
      label: 'agent',
      name: 'agent_1',
      form: { prompt: '', model: '', temperature: 0.7 }
    }
  }
}

describe('flow-store', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
  })

  it('starts clean with a start node', () => {
    const state = useFlowStore.getState()
    expect(state.dirty).toBe(false)
    expect(state.title).toBe('Untitled')
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0]?.id).toBe('start')
    expect(state.nodes[0]?.type).toBe('startNode')
    expect(state.globals).toEqual({})
  })

  it('does not mark dirty on React Flow replace that only syncs measured fields', () => {
    const start = useFlowStore.getState().nodes[0]
    const past = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'replace',
        item: { ...start, measured: { width: 140, height: 44 } } as typeof start & {
          data: typeof start.data & Record<string, unknown>
        }
      }
    ])
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().historyPast.length).toBe(past)
  })

  it('does not mark dirty on dimension measurement', () => {
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'dimensions',
        dimensions: { width: 140, height: 44 }
      }
    ])
    expect(useFlowStore.getState().dirty).toBe(false)
  })

  it('marks dirty when a node is added', () => {
    useFlowStore.getState().addNode(agentNode())
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'agent:test0001')).toBe(true)
  })

  it('creates a loopStart child when adding a container', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const startId = `${box.id}:start`
    const child = useFlowStore.getState().nodes.find((node) => node.id === startId)
    expect(child?.type).toBe('loopStartNode')
    expect(child?.parentId).toBe(box.id)
    expect(child?.position).toEqual({ x: 24, y: 56 })
  })

  it('adds a second start and refuses to delete the last remaining start', () => {
    const second = createOperatorNode('start', { x: 200, y: 200 }, useFlowStore.getState().nodes)
    expect(second.id).toMatch(/^start:[\w-]{8}$/)
    expect(second.data.name).toBe('start_1')
    useFlowStore.getState().addNode(second)
    expect(useFlowStore.getState().nodes.filter((node) => node.data.label === 'start')).toHaveLength(2)
    useFlowStore.getState().removeNode(second.id)
    expect(useFlowStore.getState().nodes.some((node) => node.id === second.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
    useFlowStore.getState().removeNode('start')
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
  })

  it('batch remove keeps at least one start', () => {
    const second = createOperatorNode('start', { x: 200, y: 200 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(second)
    useFlowStore.getState().onNodesChange([
      { id: 'start', type: 'remove' },
      { id: second.id, type: 'remove' }
    ])
    const starts = useFlowStore.getState().nodes.filter((node) => node.data.label === 'start')
    expect(starts).toHaveLength(1)
    expect(starts[0]?.id).toBe('start')
  })

  it('cascades container deletion and refuses to delete loopStart or start', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    useFlowStore.getState().addNode(task)
    useFlowStore.getState().removeNode(`${box.id}:start`)
    expect(useFlowStore.getState().nodes.some((node) => node.id === `${box.id}:start`)).toBe(true)
    useFlowStore.getState().removeNode('start')
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'start')).toBe(true)
    useFlowStore.getState().removeNode(box.id)
    expect(useFlowStore.getState().nodes.some((node) => node.id === box.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === task.id)).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === `${box.id}:start`)).toBe(false)
  })

  it('setNodeParent writes relative coordinates and can detach', () => {
    const box = createOperatorNode('foreach', { x: 100, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = agentNode()
    useFlowStore.getState().addNode(task)
    useFlowStore.getState().setNodeParent(task.id, box.id, { x: 30, y: 70 })
    const attached = useFlowStore.getState().nodes.find((node) => node.id === task.id)
    expect(attached?.parentId).toBe(box.id)
    expect(attached?.position).toEqual({ x: 30, y: 70 })
    useFlowStore.getState().setNodeParent(task.id, null, { x: 400, y: 200 })
    const detached = useFlowStore.getState().nodes.find((node) => node.id === task.id)
    expect(detached?.parentId).toBeUndefined()
    expect(detached?.position).toEqual({ x: 400, y: 200 })
  })

  it('copies a container together with its children', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    useFlowStore.getState().addNode(task)
    useFlowStore.getState().selectNode(box.id)
    useFlowStore.getState().copySelected()
    const before = useFlowStore.getState().nodes.length
    useFlowStore.getState().pasteClipboard()
    expect(useFlowStore.getState().nodes.length).toBeGreaterThan(before)
    const copies = useFlowStore.getState().nodes.filter((node) => node.data.label === 'foreach')
    expect(copies.length).toBe(2)
    const pasted = copies.find((node) => node.id !== box.id)
    expect(useFlowStore.getState().nodes.some((node) => node.id === `${pasted?.id}:start`)).toBe(true)
  })

  it('renames references when a node name changes', () => {
    const source = agentNode('agent:src0001')
    source.data = { ...source.data, name: 'agent_1', form: { prompt: '' } }
    const sink = agentNode('agent:sink0001')
    sink.data = { ...sink.data, name: 'agent_2', form: { prompt: '{{agent_1.text}}' } }
    useFlowStore.getState().addNode(source)
    useFlowStore.getState().addNode(sink)
    useFlowStore.getState().updateNodeData(source.id, { name: 'Renamed' })
    expect(useFlowStore.getState().nodes.find((node) => node.id === sink.id)?.data.form.prompt).toBe(
      '{{Renamed.text}}'
    )
  })

  it('tracks globals with dirty and reset', () => {
    useFlowStore.getState().setGlobals({ custom: { token: 'a' } })
    expect(useFlowStore.getState().globals).toEqual({ custom: { token: 'a' } })
    expect(useFlowStore.getState().dirty).toBe(true)
    useFlowStore.getState().resetToEmpty()
    expect(useFlowStore.getState().globals).toEqual({})
  })

  it('redoes an add after undo without cloning drafts', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes).toHaveLength(1)
    expect(() => useFlowStore.getState().redo()).not.toThrow()
    expect(useFlowStore.getState().nodes.some((item) => item.id === created.id)).toBe(true)
    expect(useFlowStore.getState().dirty).toBe(true)
  })

  it('clears dirty after undo back to the saved snapshot', () => {
    expect(useFlowStore.getState().dirty).toBe(false)
    useFlowStore.getState().addNode(agentNode())
    expect(useFlowStore.getState().dirty).toBe(true)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().nodes).toHaveLength(1)
  })

  it('clears selectedNodeId when the selected node is removed', () => {
    const created = agentNode('agent:gone0001')
    useFlowStore.getState().addNode(created)
    useFlowStore.getState().selectNode(created.id)
    expect(useFlowStore.getState().selectedNodeId).toBe(created.id)
    useFlowStore.getState().onNodesChange([{ id: created.id, type: 'remove' }])
    expect(useFlowStore.getState().selectedNodeId).toBeNull()
    expect(useFlowStore.getState().nodes.some((item) => item.id === created.id)).toBe(false)
  })

  it('records a history entry when a node drag ends so undo keeps the add', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    expect(useFlowStore.getState().nodes).toHaveLength(2)
    useFlowStore.getState().onNodesChange([
      {
        id: created.id,
        type: 'position',
        position: { x: 900, y: 400 },
        dragging: false
      }
    ])
    expect(useFlowStore.getState().nodes.find((item) => item.id === created.id)?.position).toEqual({
      x: 900,
      y: 400
    })
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes).toHaveLength(2)
    expect(useFlowStore.getState().nodes.find((item) => item.id === created.id)?.position).toEqual({
      x: 320,
      y: 240
    })
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes).toHaveLength(1)
  })

  it('drops switch edges whose case handle was removed', () => {
    const sw = createOperatorNode('switch', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    const msg = createOperatorNode('message', { x: 480, y: 80 }, [...useFlowStore.getState().nodes, sw])
    useFlowStore.getState().addNode(sw)
    useFlowStore.getState().addNode(msg)
    const cases = sw.data.form.cases as Array<{ id: string; label: string; expression: string }>
    const caseId = cases[0]?.id
    expect(caseId).toBeTruthy()
    useFlowStore.getState().onConnect({
      source: sw.id,
      target: msg.id,
      sourceHandle: caseId,
      targetHandle: 'end'
    })
    expect(useFlowStore.getState().edges).toHaveLength(1)
    useFlowStore.getState().updateNodeForm(sw.id, { cases: [] })
    expect(useFlowStore.getState().edges).toHaveLength(0)
  })

  it('replaceNodeForm replaces the whole form so deleted keys stay gone', () => {
    const created = createOperatorNode('custom', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(created)
    useFlowStore.getState().replaceNodeForm(created.id, { keep: 1, drop: 'x' })
    expect(useFlowStore.getState().nodes.find((item) => item.id === created.id)?.data.form).toEqual({
      keep: 1,
      drop: 'x'
    })
    useFlowStore.getState().replaceNodeForm(created.id, { keep: 2 })
    expect(useFlowStore.getState().nodes.find((item) => item.id === created.id)?.data.form).toEqual({
      keep: 2
    })
  })

  it('does not go falsely dirty after measure, save, add, and undo', () => {
    const start = useFlowStore.getState().nodes[0]
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'replace',
        item: { ...start, measured: { width: 140, height: 44 } } as typeof start & {
          data: typeof start.data & Record<string, unknown>
        }
      }
    ])
    useFlowStore.getState().markSaved('C:/tmp/demo.flow.json')
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().title).toBe('demo')
    useFlowStore.getState().addNode(agentNode())
    expect(useFlowStore.getState().dirty).toBe(true)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().title).toBe('demo')
  })

  it('records one history entry for drag-end plus setNodeParent', () => {
    const box = createOperatorNode('foreach', { x: 100, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const task = agentNode()
    useFlowStore.getState().addNode(task)
    const before = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      {
        id: task.id,
        type: 'position',
        position: { x: 110, y: 90 },
        dragging: false
      }
    ])
    useFlowStore.getState().setNodeParent(task.id, box.id, { x: 10, y: 10 })
    expect(useFlowStore.getState().historyPast.length).toBe(before + 1)
    expect(useFlowStore.getState().nodes.find((node) => node.id === task.id)?.parentId).toBe(box.id)
  })

  it('selectNode exclusive:false writes node.selected', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    useFlowStore.getState().selectNode('start')
    useFlowStore.getState().selectNode(created.id, { exclusive: false })
    expect(useFlowStore.getState().nodes.find((node) => node.id === created.id)?.selected).toBe(true)
    expect(useFlowStore.getState().nodes.find((node) => node.id === 'start')?.selected).toBe(true)
    expect(useFlowStore.getState().selectedNodeId).toBe(created.id)
  })

  it('onNodesChange select can keep two nodes selected', () => {
    const created = agentNode()
    useFlowStore.getState().addNode(created)
    useFlowStore.getState().selectNode('start')
    useFlowStore.getState().onNodesChange([{ id: created.id, type: 'select', selected: true }])
    const selected = useFlowStore.getState().nodes.filter((node) => node.selected).map((node) => node.id)
    expect(selected.sort()).toEqual([created.id, 'start'].sort())
  })

  it('loadDocument accepts null path and markUnsaved stays dirty until markSaved', () => {
    const { nodes, edges, title, globals } = useFlowStore.getState()
    const doc = graphToDocument(nodes, edges, title, globals)
    useFlowStore.getState().loadDocument(doc, null)
    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().dirty).toBe(false)
    useFlowStore.getState().markUnsaved()
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().savedSnapshotKey).toBe('')
    useFlowStore.getState().addNode(agentNode())
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().dirty).toBe(true)
    useFlowStore.getState().addNode(agentNode())
    useFlowStore.getState().markSaved('C:/tmp/restored.flow.json')
    expect(useFlowStore.getState().dirty).toBe(false)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().dirty).toBe(true)
  })

  it('markUnsaved stays dirty after a dimensions change', () => {
    const { nodes, edges, title, globals } = useFlowStore.getState()
    const doc = graphToDocument(nodes, edges, title, globals)
    useFlowStore.getState().loadDocument(doc, null)
    useFlowStore.getState().markUnsaved()
    useFlowStore.getState().onNodesChange([
      {
        id: 'start',
        type: 'dimensions',
        dimensions: { width: 140, height: 44 }
      }
    ])
    expect(useFlowStore.getState().dirty).toBe(true)
  })

  it('resetToEmpty increments viewportRequest', () => {
    const before = useFlowStore.getState().viewportRequest
    useFlowStore.getState().resetToEmpty()
    expect(useFlowStore.getState().viewportRequest).toBe(before + 1)
  })

  it('applyNodePositions writes coords/size, pushes one history entry, and undoes', () => {
    const start = useFlowStore.getState().nodes[0]
    const past = useFlowStore.getState().historyPast.length
    const origin = { ...start.position }
    useFlowStore.getState().applyNodePositions(
      { start: { x: 50, y: 60 } },
      { start: { width: 200, height: 80 } }
    )
    const moved = useFlowStore.getState().nodes[0]
    expect(moved?.position).toEqual({ x: 50, y: 60 })
    expect(moved?.width).toBe(200)
    expect(moved?.height).toBe(80)
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().historyPast.length).toBe(past + 1)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes[0]?.position).toEqual(origin)
    expect(useFlowStore.getState().dirty).toBe(false)
  })

  it('loadDocument resets history; setTitle pushes; markSaved does not', () => {
    const { nodes, edges, title, globals } = useFlowStore.getState()
    const doc = graphToDocument(nodes, edges, title, globals)
    useFlowStore.getState().addNode(agentNode())
    expect(useFlowStore.getState().historyPast.length).toBeGreaterThan(1)
    useFlowStore.getState().loadDocument(doc, 'C:/tmp/loaded.flow.json')
    expect(useFlowStore.getState().historyPast).toHaveLength(1)
    expect(useFlowStore.getState().filePath).toBe('C:/tmp/loaded.flow.json')
    expect(useFlowStore.getState().dirty).toBe(false)
    useFlowStore.getState().setTitle('Hello')
    expect(useFlowStore.getState().historyPast).toHaveLength(2)
    expect(useFlowStore.getState().dirty).toBe(true)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().title).toBe(title)
    expect(useFlowStore.getState().dirty).toBe(false)
    const afterUndo = useFlowStore.getState().historyPast.length
    useFlowStore.getState().markSaved('C:/tmp/saved.flow.json')
    expect(useFlowStore.getState().historyPast.length).toBe(afterUndo)
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().title).toBe('saved')
  })

  it('moveOutgoingEdge reorders start edges, exports downstream, and undoes', () => {
    const t1 = createOperatorNode('agent', { x: 300, y: 80 }, useFlowStore.getState().nodes)
    t1.data = { ...t1.data, name: 'one' }
    useFlowStore.getState().addNode(t1)
    const t2 = createOperatorNode('agent', { x: 300, y: 160 }, useFlowStore.getState().nodes)
    t2.data = { ...t2.data, name: 'two' }
    useFlowStore.getState().addNode(t2)
    const t3 = createOperatorNode('agent', { x: 300, y: 240 }, useFlowStore.getState().nodes)
    t3.data = { ...t3.data, name: 'three' }
    useFlowStore.getState().addNode(t3)
    const t4 = createOperatorNode('agent', { x: 300, y: 320 }, useFlowStore.getState().nodes)
    t4.data = { ...t4.data, name: 'four' }
    useFlowStore.getState().addNode(t4)
    for (const target of [t1, t2, t3, t4]) {
      useFlowStore.getState().onConnect({
        source: 'start',
        sourceHandle: 'start#new',
        target: target.id,
        targetHandle: 'end'
      })
    }
    expect(useFlowStore.getState().edges.every((item) => item.sourceHandle === 'start')).toBe(true)
    expect(useFlowStore.getState().edges.map((item) => item.target)).toEqual([t1.id, t2.id, t3.id, t4.id])

    const third = useFlowStore.getState().edges[2]
    expect(third).toBeDefined()
    useFlowStore.getState().moveOutgoingEdge(third!.id, 0)
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().edges.map((item) => item.target)).toEqual([t3.id, t1.id, t2.id, t4.id])
    expect(graphToDocument(useFlowStore.getState().nodes, useFlowStore.getState().edges, 'Demo').components.start?.downstream).toEqual(
      [t3.id, t1.id, t2.id, t4.id]
    )

    const last = useFlowStore.getState().edges[3]
    expect(last).toBeDefined()
    useFlowStore.getState().moveOutgoingEdge(last!.id, 0)
    expect(useFlowStore.getState().edges.map((item) => item.target)).toEqual([t4.id, t3.id, t1.id, t2.id])
    expect(graphToDocument(useFlowStore.getState().nodes, useFlowStore.getState().edges, 'Demo').components.start?.downstream).toEqual(
      [t4.id, t3.id, t1.id, t2.id]
    )

    useFlowStore.getState().undo()
    expect(useFlowStore.getState().edges.map((item) => item.target)).toEqual([t3.id, t1.id, t2.id, t4.id])
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().edges.map((item) => item.target)).toEqual([t1.id, t2.id, t3.id, t4.id])
  })

  it('pointer-resolved parent change plus setNodeParent adds one history entry', () => {
    const box = createOperatorNode('foreach', { x: 100, y: 80 }, useFlowStore.getState().nodes)
    box.width = 420
    box.height = 280
    useFlowStore.getState().addNode(box)
    const task = agentNode()
    useFlowStore.getState().addNode(task)
    const before = useFlowStore.getState().historyPast.length
    useFlowStore.getState().onNodesChange([
      { id: task.id, type: 'position', position: { x: 110, y: 90 }, dragging: false }
    ])
    const nodes = useFlowStore.getState().nodes
    const latest = nodes.find((item) => item.id === task.id)
    expect(latest).toBeDefined()
    if (!latest) return
    const change = resolveParentAfterDrag(latest, nodes, { x: 200, y: 160 })
    expect(change?.parentId).toBe(box.id)
    if (!change) return
    useFlowStore.getState().setNodeParent(task.id, change.parentId, change.position)
    expect(useFlowStore.getState().historyPast.length).toBe(before + 1)
    expect(useFlowStore.getState().nodes.find((item) => item.id === task.id)?.parentId).toBe(box.id)
  })
})

