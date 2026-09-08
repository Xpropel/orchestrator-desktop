import type { Edge, Node } from '@xyflow/react'
import { HANDLE_START, isLogicalStartHandle, physicalSourceHandle } from '@/core/handles'
import type { BaseNodeData, FlowEdge, FlowNode } from '@/core/types'

type CanvasNodeData = BaseNodeData & Record<string, unknown>
export type CanvasNode = Node<CanvasNodeData>
export type CanvasEdge = Edge

export function toCanvasNode(node: FlowNode): CanvasNode {
  return node as CanvasNode
}

export function toCanvasNodes(nodes: FlowNode[]): CanvasNode[] {
  return nodes as CanvasNode[]
}

export function toCanvasEdges(edges: FlowEdge[]): CanvasEdge[] {
  const rankById = new Map<string, number>()
  const counts = new Map<string, number>()
  for (const edge of edges) {
    if (!isLogicalStartHandle(edge.sourceHandle)) continue
    const next = (counts.get(edge.source) ?? 0) + 1
    counts.set(edge.source, next)
    rankById.set(edge.id, next)
  }
  return edges.map((edge) => {
    const rank = rankById.get(edge.id)
    if (rank == null) return edge as CanvasEdge
    return { ...edge, sourceHandle: physicalSourceHandle(HANDLE_START, rank) } as CanvasEdge
  })
}

export function toFlowNode(node: CanvasNode): FlowNode {
  return node as FlowNode
}
