import type { NodeChange } from '@xyflow/react'
import { current } from 'immer'
import {
  cloneGraph,
  collectDanglingEdgeIds,
  createStartNode,
  graphsEqual,
  remapClipboard,
  snapshotKeyOf,
  type ClipboardGraph,
  type GraphSnapshot
} from '@/core/graph'
import { renameReferencesInGraph } from '@/core/variables'
import type { FlowEdge, FlowNode } from '@/core/types'
import type { FlowState, RfNode } from './flow-state'

const MAX_HISTORY = 51

export function emptyCanvas(): Pick<
  FlowState,
  'nodes' | 'edges' | 'selectedNodeId' | 'filePath' | 'title' | 'dirty' | 'globals'
> {
  return {
    nodes: [createStartNode()],
    edges: [],
    selectedNodeId: null,
    filePath: null,
    title: 'Untitled',
    dirty: false,
    globals: {}
  }
}

export function isDirtyNodeChange(change: NodeChange<RfNode>, nodes: FlowNode[]): boolean {
  if (change.type === 'add' || change.type === 'remove') {
    return true
  }
  if (change.type === 'replace') {
    const currentNode = nodes.find((node) => node.id === change.id)
    if (!currentNode) {
      return true
    }
    const next = change.item
    if (next.position.x !== currentNode.position.x || next.position.y !== currentNode.position.y) {
      return true
    }
    if ((next.parentId ?? null) !== (currentNode.parentId ?? null)) {
      return true
    }
    return JSON.stringify(next.data) !== JSON.stringify(currentNode.data)
  }
  if (change.type === 'position' && change.dragging === false) {
    return true
  }
  if (change.type === 'dimensions' && change.resizing === false) {
    return true
  }
  return false
}

export function unwrap<T>(value: T): T {
  try {
    return current(value)
  } catch {
    return value
  }
}

export function snapshotOf(
  nodes: FlowNode[],
  edges: FlowEdge[],
  title: string,
  globals: Record<string, unknown>
): GraphSnapshot {
  return cloneGraph(unwrap(nodes), unwrap(edges), title, unwrap(globals))
}

export function keyOf(nodes: FlowNode[], edges: FlowEdge[], title: string, globals: Record<string, unknown>): string {
  return snapshotKeyOf(snapshotOf(nodes, edges, title, globals))
}

export function syncDirtyFromSnapshot(state: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  title: string
  globals: Record<string, unknown>
  dirty: boolean
  savedSnapshotKey: string
}): void {
  state.dirty =
    snapshotKeyOf(snapshotOf(state.nodes, state.edges, state.title, state.globals)) !== state.savedSnapshotKey
}

export function pushSnapshot(state: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  title: string
  globals: Record<string, unknown>
  selectedNodeId?: string | null
  historyPast: GraphSnapshot[]
  historyFuture: GraphSnapshot[]
}): void {
  const snap = snapshotOf(state.nodes, state.edges, state.title, state.globals)
  snap.selectedNodeId = state.selectedNodeId ?? null
  const last = state.historyPast[state.historyPast.length - 1]
  if (last && graphsEqual(last, snap)) return
  state.historyPast.push(snap)
  if (state.historyPast.length > MAX_HISTORY) {
    state.historyPast.shift()
  }
  state.historyFuture = []
}

export function replaceTopSnapshot(state: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  title: string
  globals: Record<string, unknown>
  selectedNodeId: string | null
  historyPast: GraphSnapshot[]
  historyFuture: GraphSnapshot[]
}): void {
  const snap = snapshotOf(state.nodes, state.edges, state.title, state.globals)
  snap.selectedNodeId = state.selectedNodeId
  if (state.historyPast.length === 0) {
    state.historyPast.push(snap)
  } else {
    state.historyPast[state.historyPast.length - 1] = snap
  }
  state.historyFuture = []
}

export function pruneDraft(state: { nodes: FlowNode[]; edges: FlowEdge[] }): boolean {
  const dangling = new Set(collectDanglingEdgeIds(state.nodes, state.edges))
  if (dangling.size === 0) return false
  state.edges = state.edges.filter((edge) => !dangling.has(edge.id))
  return true
}

export function applyRename(state: { nodes: FlowNode[] }, oldName: string, newName: string): void {
  if (!oldName || !newName || oldName === newName) return
  state.nodes = renameReferencesInGraph(unwrap(state.nodes), oldName, newName)
}

export function dropIds(
  state: { nodes: FlowNode[]; edges: FlowEdge[]; selectedNodeId: string | null },
  ids: ReadonlySet<string>
): void {
  if (ids.size === 0) return
  state.nodes = state.nodes.filter((node) => !ids.has(node.id))
  state.edges = state.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target))
  if (state.selectedNodeId && ids.has(state.selectedNodeId)) {
    state.selectedNodeId = null
  }
}

export function applyClipboard(
  state: {
    nodes: FlowNode[]
    edges: FlowEdge[]
    selectedNodeId: string | null
    dirty: boolean
    title: string
    globals: Record<string, unknown>
    savedSnapshotKey: string
    historyPast: GraphSnapshot[]
    historyFuture: GraphSnapshot[]
  },
  payload: ClipboardGraph
): void {
  const remapped = remapClipboard(payload, unwrap(state.nodes), { x: 40, y: 40 })
  if (remapped.nodes.length === 0) return
  state.nodes.forEach((node) => {
    node.selected = false
  })
  state.nodes.push(...remapped.nodes)
  state.edges.push(...remapped.edges)
  state.selectedNodeId = remapped.nodes[0]?.id ?? null
  pushSnapshot(state)
  syncDirtyFromSnapshot(state)
}

export function titleFromPath(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? filePath
  return base.replace(/\.flow\.json$/i, '').replace(/\.json$/i, '') || 'Untitled'
}
