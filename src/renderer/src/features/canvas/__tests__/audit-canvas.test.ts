import { beforeAll, describe, expect, it } from 'vitest'
import { createOperatorNode, createStartNode, hasMatchingConnection } from '@/core/graph'
import { HANDLE_END, HANDLE_START, logicalHandleId } from '@/core/handles'
import { loadLibrary } from '@/core/library'
import type { FlowEdge, FlowNode } from '@/core/types'
import { planConnectEnd, planPickerConnect, resolveConnectEndPoint } from '../plan-connect-end'
import { planAddAtViewportCenter } from '../plan-add-node'
import { nextSelectedIds, planNodeClick, selectedIdsOf, selectionChangesFor } from '../plan-node-click'
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
  it('cancels when the same edge is already stored', () => {
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

  it('still connects when React Flow only reports a valid hover', () => {
    expect(
      planConnectEnd({
        point: { x: 560, y: 40 },
        nodes: [start, agent, other],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'b',
        alreadyConnected: false
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'a', sourceHandle: HANDLE_START, target: 'b', targetHandle: HANDLE_END }
    })
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

  it('toasts when the source is an end node', () => {
    const end = node('end', {
      type: 'endNode',
      position: { x: 200, y: 200 },
      width: 140,
      height: 44,
      data: { label: 'end', name: 'End_1', form: {} }
    })
    expect(
      planConnectEnd({
        point: { x: 560, y: 40 },
        nodes: [start, end, other],
        edges: [],
        sourceId: 'end',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'toast', message: '不能连接：该节点没有出口' })
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

  it('prefers the pointer when a snapped flow point has already left the container', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    const pointer = { x: 120, y: 200 }
    const snapped = { x: 800, y: 200 }
    expect(resolveConnectEndPoint(snapped, pointer, [box, inner], 'inner')).toEqual(pointer)
    expect(resolveConnectEndPoint(snapped, { x: 900, y: 200 }, [box, inner], 'inner')).toEqual(snapped)
    expect(resolveConnectEndPoint({ x: 120, y: 200 }, { x: 800, y: 200 }, [box, inner], 'inner')).toEqual({
      x: 800,
      y: 200
    })
    expect(resolveConnectEndPoint(undefined, pointer, [box, inner], 'inner')).toEqual(pointer)
    const note = node('note', {
      type: 'noteNode',
      position: { x: 400, y: 180 },
      width: 200,
      height: 140,
      data: { label: 'note', name: 'note', form: {} }
    })
    expect(resolveConnectEndPoint({ x: 10, y: 10 }, { x: 500, y: 250 }, [box, inner, note], 'inner')).toEqual({
      x: 500,
      y: 250
    })
    const iff = node('if1', {
      type: 'branchNode',
      position: { x: 400, y: 0 },
      width: 240,
      height: 128,
      data: { label: 'if', name: 'If_1', form: { cases: [{ id: 'c1', label: 'Yes', expression: 'x' }] } }
    })
    expect(resolveConnectEndPoint({ x: 20, y: 20 }, { x: 520, y: 60 }, [start, iff], 'start')).toEqual({
      x: 520,
      y: 60
    })
  })

  it('toasts when the pointer lands on a note instead of opening the picker', () => {
    const note = node('note', {
      type: 'noteNode',
      position: { x: 400, y: 180 },
      width: 200,
      height: 140,
      data: { label: 'note', name: 'note', form: {} }
    })
    expect(
      planConnectEnd({
        point: { x: 500, y: 250 },
        nodes: [start, agent, note],
        edges: [],
        sourceId: 'a',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'toast', message: '不能连接：便签不能连线' })
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

  it('opens a root picker when a loop-body connection is dropped outside the container', () => {
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
    ).toEqual({ kind: 'picker', parentId: null })
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

  it('still cancels a source-container body drop when a nearby node is only in the pad', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const near = node('near', { position: { x: 420, y: 40 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 390, y: 80 },
        nodes: [start, box, near],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'none' })
  })

  it('does not let the pad steal a sibling instead of the empty-body picker', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const sibling = node('sibling', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 180 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 160, y: 155 },
        nodes: [box, sibling, inner],
        edges: [],
        sourceId: 'inner',
        sourceParentId: 'loop',
        sourceHandle: HANDLE_START
      })
    ).toEqual({ kind: 'picker', parentId: 'loop' })
  })

  it('prefers the child under the pointer when RF snaps toHandle to the parent', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    const outside = node('out', { position: { x: 500, y: 40 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 160, y: 100 },
        nodes: [box, inner, outside],
        edges: [edge('e1', 'out', 'loop')],
        sourceId: 'out',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        toHandleNodeId: 'loop',
        alreadyConnected: true
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'out', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('prefers the child under the pointer when a container source snaps toHandle to a sibling', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const sibling = node('sibling', { parentId: 'loop', position: { x: 40, y: 180 }, width: 240, height: 80 })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 160, y: 100 },
        nodes: [start, box, sibling, inner],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        toHandleNodeId: 'sibling'
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'loop', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('connects an inner source onto its ancestor container via the target handle', () => {
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
        point: { x: 0, y: 150 },
        nodes: [box, inner],
        edges: [],
        sourceId: 'inner',
        sourceParentId: 'loop',
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        toHandleNodeId: 'loop'
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'inner', sourceHandle: HANDLE_START, target: 'loop', targetHandle: HANDLE_END }
    })
  })

  it('cancels alreadyConnected only when the RF target is the actual hit', () => {
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
        point: { x: 160, y: 100 },
        nodes: [start, box, inner],
        edges: [edge('e1', 'loop', 'inner')],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'inner',
        toHandleNodeId: 'inner',
        alreadyConnected: true
      })
    ).toEqual({ kind: 'none' })
  })

  it('connects a container outgoing port onto a child inside its body', () => {
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
        point: { x: 160, y: 100 },
        nodes: [start, box, inner],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'loop', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('connects a container to a child when RF snaps the handle but reports the parent as toNode', () => {
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
        point: { x: 0, y: 0 },
        nodes: [start, box, inner],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        toHandleNodeId: 'inner',
        alreadyConnected: false
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'loop', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('connects a container to a child when the drop is on the child target handle', () => {
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
        point: { x: 32, y: 100 },
        nodes: [start, box, inner],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        alreadyConnected: false
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'loop', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('connects a container to a child when React Flow reports the parent as toNode', () => {
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
        point: { x: 160, y: 100 },
        nodes: [start, box, inner],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        alreadyConnected: false
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'loop', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('connects a loop-body source onto a node outside the container', () => {
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
    expect(plan).toEqual({
      kind: 'connect',
      connection: { source: 'inner', sourceHandle: HANDLE_START, target: 'out', targetHandle: HANDLE_END }
    })
  })

  it('connects an outside source onto a node inside the container', () => {
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
      point: { x: 80, y: 80 },
      nodes: [box, inner, outside],
      edges: [],
      sourceId: 'out',
      sourceParentId: null,
      sourceHandle: HANDLE_START
    })
    expect(plan).toEqual({
      kind: 'connect',
      connection: { source: 'out', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('still connects to a child when an edge to the parent exists and RF reports the parent as toNode', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    const outside = node('out', { position: { x: 500, y: 40 }, width: 240, height: 80 })
    const edges = [edge('e1', 'out', 'loop')]
    const toNodeId = 'loop'
    const alreadyConnected = hasMatchingConnection(edges, {
      source: 'out',
      sourceHandle: HANDLE_START,
      target: toNodeId
    })
    expect(alreadyConnected).toBe(true)
    expect(
      planConnectEnd({
        point: { x: 80, y: 80 },
        nodes: [box, inner, outside],
        edges,
        sourceId: 'out',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId,
        alreadyConnected
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'out', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
  })

  it('opens a body picker from an inner source even when RF reports the parent as toNode', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    const edges = [edge('e1', 'inner', 'loop')]
    const alreadyConnected = hasMatchingConnection(edges, {
      source: 'inner',
      sourceHandle: HANDLE_START,
      target: 'loop'
    })
    expect(alreadyConnected).toBe(true)
    expect(
      planConnectEnd({
        point: { x: 120, y: 200 },
        nodes: [box, inner],
        edges,
        sourceId: 'inner',
        sourceParentId: 'loop',
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        alreadyConnected
      })
    ).toEqual({ kind: 'picker', parentId: 'loop' })
  })

  it('connects from a while container onto a child the same way as foreach', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'while', name: 'loop', form: {} }
    })
    const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
    expect(
      planConnectEnd({
        point: { x: 160, y: 100 },
        nodes: [start, box, inner],
        edges: [],
        sourceId: 'loop',
        sourceParentId: null,
        sourceHandle: HANDLE_START,
        toNodeId: 'loop',
        alreadyConnected: false
      })
    ).toEqual({
      kind: 'connect',
      connection: { source: 'loop', sourceHandle: HANDLE_START, target: 'inner', targetHandle: HANDLE_END }
    })
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

describe('planNodeClick', () => {
  it('opens the inspector on a plain click and adds on Shift/Ctrl/Meta', () => {
    expect(planNodeClick({}, 'b', ['a'])).toEqual({ kind: 'exclusive', id: 'b', openInspector: true })
    expect(planNodeClick({ shiftKey: true }, 'b', ['a'])).toEqual({ kind: 'add', id: 'b' })
    expect(planNodeClick({ ctrlKey: true }, 'a', ['a'])).toEqual({ kind: 'remove', id: 'a' })
    expect(planNodeClick({ metaKey: true }, 'b', ['a'])).toEqual({ kind: 'add', id: 'b' })
    expect(planNodeClick({ metaKey: true }, 'a', ['a'])).toEqual({ kind: 'remove', id: 'a' })
    expect(nextSelectedIds({ kind: 'add', id: 'b' }, ['a'])).toEqual(['a', 'b'])
    expect(nextSelectedIds({ kind: 'remove', id: 'a' }, ['a', 'b'])).toEqual(['b'])
  })

  it('writes select changes that keep both nodes selected after an exclusive RF click', () => {
    const nodes = [
      { id: 'a', selected: false },
      { id: 'b', selected: true }
    ]
    const snapshot = selectedIdsOf([{ id: 'a', selected: true }, { id: 'b', selected: false }])
    expect(snapshot).toEqual(['a'])
    const nextIds = nextSelectedIds(planNodeClick({ shiftKey: true }, 'b', snapshot), snapshot)
    expect(nextIds).toEqual(['a', 'b'])
    expect(selectionChangesFor(nodes, nextIds)).toEqual([{ id: 'a', type: 'select', selected: true }])
    const metaIds = nextSelectedIds(planNodeClick({ metaKey: true }, 'b', snapshot), snapshot)
    expect(metaIds).toEqual(['a', 'b'])
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
