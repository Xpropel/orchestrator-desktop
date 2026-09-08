import { beforeAll, describe, expect, it } from 'vitest'
import { createOperatorNode, createStartNode } from '@/core/graph'
import { HANDLE_END, HANDLE_START, logicalHandleId } from '@/core/handles'
import { loadLibrary } from '@/core/library'
import type { FlowEdge, FlowNode } from '@/core/types'
import { LEAVE_CONTAINER_TOAST, planConnectEnd, planPickerConnect } from '../plan-connect-end'
import { planAddAtViewportCenter } from '../plan-add-node'
import { REACT_FLOW_DELETE_KEY_CODE } from '../canvas'
import { toCanvasEdges } from '../flow-types'

beforeAll(() => {
  loadLibrary()
})

function node(id: string, extras?: Partial<FlowNode>): FlowNode {
  return {
    id,
    type: extras?.type ?? 'taskNode',
    position: extras?.position ?? { x: 0, y: 0 },
    data: extras?.data ?? { label: 'agent', name: id, form: {} },
    ...extras
  }
}

function edge(id: string, source: string, target: string, sourceHandle: string | null = 'start'): FlowEdge {
  return { id, source, target, sourceHandle, targetHandle: 'end' }
}

const start = node('start', {
  type: 'startNode',
  position: { x: 0, y: 0 },
  width: 140,
  height: 44,
  data: { label: 'start', name: 'start', form: {} }
})
const agent = node('a', { position: { x: 200, y: 0 }, width: 240, height: 80 })
const other = node('b', { position: { x: 500, y: 0 }, width: 240, height: 80 })

describe('planConnectEnd', () => {
  it('cancels when React Flow already accepted the handle drop', () => {
    expect(
      planConnectEnd({
        point: { x: 560, y: 40 },
        nodes: [start, agent, other],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'b',
        alreadyConnected: true
      })
    ).toEqual({ kind: 'none' })
  })

  it('cancels a drop on the source body instead of opening the picker', () => {
    expect(
      planConnectEnd({
        point: { x: 260, y: 40 },
        nodes: [start, agent, other],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'none' })
  })

  it('connects a body drop to the target end handle with a logical start source', () => {
    expect(
      planConnectEnd({
        point: { x: 560, y: 40 },
        nodes: [start, agent, other],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'a', sourceHandle: HANDLE_START, target: 'b', targetHandle: HANDLE_END }
    })
  })

  it('toasts a duplicate body drop instead of staying silent', () => {
    const plan = planConnectEnd({
      point: { x: 560, y: 40 },
      nodes: [start, agent, other],
      edges: [edge('e1', 'a', 'b')],
      sourceId: 'a',
      sourceParentId: null,
      sourceHandle: HANDLE_START
    })
    expect(plan).toEqual({ kind: 'toast', message: '不能连接：重复的连线' })
  })

  it('toasts when the body drop is a start node', () => {
    const plan = planConnectEnd({
      point: { x: 40, y: 20 },
      nodes: [start, agent],
      edges: [],
      sourceId: 'a',
      sourceParentId: null,
      sourceHandle: HANDLE_START
    })
    expect(plan).toEqual({ kind: 'toast', message: '不能连接：不能连到开始节点' })
  })

  it('keeps a branch sourceHandle (else / case / approved)', () => {
    const branch = node('if1', {
      type: 'branchNode',
      position: { x: 200, y: 200 },
      width: 240,
      height: 128,
      data: { label: 'if', name: 'If_1', form: { cases: [{ id: 'c1', label: 'Yes', expression: 'x' }] } }
    })
    expect(
      planConnectEnd({
        point: { x: 560, y: 40 },
        nodes: [start, branch, other],
        edges: [],
        sourceId: 'if1',
        sourceParentId: null,
        sourceHandle: 'else'
      })
    ).toMatchObject({
      kind: 'connect',
      connection: { source: 'if1', sourceHandle: 'else', target: 'b' }
    })
  })

  it('connects an outside source onto a container body via the end handle', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 200 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    expect(
      planConnectEnd({
        point: { x: 120, y: 320 },
        nodes: [start, agent, box],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'a', sourceHandle: HANDLE_START, target: 'loop', targetHandle: HANDLE_END }
    })
  })

  it('does not connect onto a note via the toNode fallback', () => {
    const note = node('note', {
      type: 'noteNode',
      position: { x: 500, y: 200 },
      width: 200,
      height: 140,
      data: { label: 'note', name: 'note', form: {} }
    })
    expect(
      planConnectEnd({
        point: { x: 10, y: 400 },
        nodes: [start, agent, note],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'note'
      })
    ).toEqual({ kind: 'picker', parentId: null })
  })

  it('opens a nested picker when dropping on empty space inside the source container', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 120, y: 200 },
        nodes: [box, inner],
        edges: [],
        sourceId: 'inner',
        sourceParentId: 'loop',
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'picker', parentId: 'loop' })
  })

  it('toasts when a loop-body connection is dropped outside the container', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 100, y: 100 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 800, y: 200 },
        nodes: [box, inner],
        edges: [],
        sourceId: 'inner',
        sourceParentId: 'loop',
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'toast', message: LEAVE_CONTAINER_TOAST })
  })

  it('cancels dropping a container outgoing port onto its own body', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    expect(
      planConnectEnd({
        point: { x: 120, y: 160 },
        nodes: [start, box],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'none' })
  })

  it('toasts a cross-container body drop instead of opening the picker', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    const outside = node('out', { position: { x: 500, y: 40 }, width: 240, height: 80 })
    const plan = planConnectEnd({
      point: { x: 560, y: 60 },
      nodes: [box, inner, outside],
      edges: [],
      sourceId: 'inner',
      sourceParentId: 'loop',
      sourceHandle: HANDLE_START
    })
    expect(plan).toEqual({ kind: 'toast', message: '不能连接：不能跨容器' })
  })
})

describe('planPickerConnect', () => {
  it('stores a logical start handle after dragging from start#new', () => {
    const created = createOperatorNode('agent', { x: 0, y: 0 }, [createStartNode()])
    expect(planPickerConnect(created, { source: 'src', sourceHandle: 'start#new' })).toEqual({
      source: 'src',
      sourceHandle: HANDLE_START,
      target: created.id,
      targetHandle: HANDLE_END
    })
    expect(logicalHandleId('start#3')).toBe(HANDLE_START)
  })

  it('keeps a branch outlet id when connecting after the picker', () => {
    const created = createOperatorNode('message', { x: 0, y: 0 }, [createStartNode()])
    expect(planPickerConnect(created, { source: 'if1', sourceHandle: 'else' }).sourceHandle).toBe('else')
    expect(planPickerConnect(created, { source: 'appr', sourceHandle: 'approved' }).sourceHandle).toBe('approved')
  })
})

describe('React Flow delete keys', () => {
  it('disables RF keyboard delete so menu/shortcuts own removeSelected', () => {
    expect(REACT_FLOW_DELETE_KEY_CODE).toBeNull()
  })
})

describe('planAddAtViewportCenter / toCanvasEdges', () => {
  it('rejects click-to-add break at the viewport center', () => {
    expect(planAddAtViewportCenter('break', [createStartNode()], { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })).toEqual({
      ok: false,
      toast: 'break 只能放在循环容器内'
    })
  })

  it('places click-to-add away from the existing start node', () => {
    const seed = createStartNode()
    const result = planAddAtViewportCenter('agent', [seed], { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.parentId).toBeUndefined()
    expect(result.node.position).not.toEqual(seed.position)
  })

  it('rewrites store start edges to physical start#rank for the canvas', () => {
    const canvas = toCanvasEdges([edge('a', 'src', 't1'), edge('b', 'src', 't2', 'else'), edge('c', 'src', 't3')])
    expect(canvas.map((item) => item.sourceHandle)).toEqual(['start#1', 'else', 'start#2'])
  })
})
