import { deepClone } from '../clone'
import type { FlowEdge, FlowNode } from '../types'

export const NODE_RUNTIME_KEYS = ['selected', 'dragging', 'measured', 'resizing', 'positionAbsolute'] as const
export const EDGE_RUNTIME_KEYS = ['selected', 'dragging', 'measured'] as const

export interface GraphSnapshot {
  nodes: FlowNode[]
  edges: FlowEdge[]
  title: string
  globals: Record<string, unknown>
  selectedNodeId?: string | null
}

function omitKeys<T extends object>(value: T, keys: readonly string[]): T {
  const cloned = deepClone(value) as T & Record<string, unknown>
  for (const key of keys) {
    delete cloned[key]
  }
  return cloned
}

function persistExplicitSize(node: FlowNode): FlowNode {
  const width = node.width
  const height = node.height
  if (typeof width !== 'number' && typeof height !== 'number') return node
  const prev = node.style && typeof node.style === 'object' ? (node.style as Record<string, unknown>) : {}
  const nextStyle: Record<string, unknown> = { ...prev }
  if (typeof width === 'number') nextStyle.width = width
  if (typeof height === 'number') nextStyle.height = height
  if (prev.width === nextStyle.width && prev.height === nextStyle.height) return node
  return { ...node, style: nextStyle }
}

export function stripRuntimeNode(node: FlowNode): FlowNode {
  return persistExplicitSize(omitKeys(node, NODE_RUNTIME_KEYS))
}

export function stripRuntimeEdge(edge: FlowEdge): FlowEdge {
  return omitKeys(edge, EDGE_RUNTIME_KEYS)
}

/** 与落盘 `graphToDocument` 共用：去掉 RF 运行时字段，只留拓扑 / data / parentId / position / 显式尺寸。 */
export function stripRuntimeFields(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: nodes.map(stripRuntimeNode),
    edges: edges.map(stripRuntimeEdge)
  }
}

export function cloneGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  title = '',
  globals: Record<string, unknown> = {}
): GraphSnapshot {
  const stripped = stripRuntimeFields(nodes, edges)
  return {
    nodes: stripped.nodes,
    edges: stripped.edges,
    title,
    globals: deepClone(globals)
  }
}

export function graphsEqual(left: GraphSnapshot, right: GraphSnapshot): boolean {
  return (
    left.title === right.title &&
    JSON.stringify(left.nodes) === JSON.stringify(right.nodes) &&
    JSON.stringify(left.edges) === JSON.stringify(right.edges) &&
    JSON.stringify(left.globals ?? {}) === JSON.stringify(right.globals ?? {})
  )
}

export function snapshotKeyOf(snapshot: GraphSnapshot): string {
  return JSON.stringify({
    title: snapshot.title,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    globals: snapshot.globals ?? {}
  })
}
