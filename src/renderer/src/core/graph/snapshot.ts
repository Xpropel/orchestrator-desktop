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

export function stripRuntimeNode(node: FlowNode): FlowNode {
  return omitKeys(node, NODE_RUNTIME_KEYS)
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
