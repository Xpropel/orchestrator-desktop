import { explainInvalidConnection } from '@/core/graph'
import { HANDLE_END, HANDLE_START, logicalHandleId } from '@/core/handles'
import { getTargetHandles, hasOperator } from '@/core/registry'
import type { FlowEdge, FlowNode, XYPosition } from '@/core/types'
import {
  dropLeavesContainer,
  isIgnoredConnectTarget,
  isSourceOrAncestor,
  pickDropTargetNode,
  pointHitsNode
} from '@/features/canvas/drop-target'

export const LEAVE_CONTAINER_TOAST = '不能连接：循环体内的连线不能离开容器'

export type ConnectEndPlan =
  | { kind: 'none' }
  | { kind: 'toast'; message: string }
  | {
      kind: 'connect'
      connection: { source: string; sourceHandle: string; target: string; targetHandle: string }
    }
  | { kind: 'picker'; parentId: string | null }

export function targetHandleForNode(node: FlowNode): string {
  if (!hasOperator(node.data.label)) return HANDLE_END
  return getTargetHandles(node.data.label)[0]?.id ?? HANDLE_END
}

export function planPickerConnect(
  created: FlowNode,
  connect: { source: string; sourceHandle: string | null }
): { source: string; sourceHandle: string; target: string; targetHandle: string } {
  return {
    source: connect.source,
    sourceHandle: logicalHandleId(connect.sourceHandle) ?? HANDLE_START,
    target: created.id,
    targetHandle: logicalHandleId(targetHandleForNode(created)) ?? HANDLE_END
  }
}

export function planConnectEnd(input: {
  point: XYPosition
  nodes: FlowNode[]
  edges: FlowEdge[]
  sourceId: string
  sourceParentId: string | null
  sourceHandle: string
  toNodeId?: string | null
  alreadyConnected?: boolean
}): ConnectEndPlan {
  if (input.alreadyConnected) return { kind: 'none' }
  // 松在起点自身（含点了一下 + 出口）是取消，不是在自己身上新建算子。
  if (pointHitsNode(input.point, input.nodes, input.sourceId)) return { kind: 'none' }

  const picked = pickDropTargetNode(input.point, input.nodes, input.sourceId)
  const fallback =
    input.toNodeId && !isSourceOrAncestor(input.nodes, input.sourceId, input.toNodeId)
      ? input.nodes.find((node) => node.id === input.toNodeId)
      : undefined
  const hit = picked ?? (fallback && !isIgnoredConnectTarget(fallback) ? fallback : undefined)

  if (hit) {
    const connection = {
      source: input.sourceId,
      sourceHandle: input.sourceHandle,
      target: hit.id,
      targetHandle: targetHandleForNode(hit)
    }
    const reason = explainInvalidConnection(input.nodes, input.edges, connection)
    if (reason) return { kind: 'toast', message: reason }
    return { kind: 'connect', connection }
  }

  if (dropLeavesContainer(input.point, input.nodes, input.sourceId)) {
    return { kind: 'toast', message: LEAVE_CONTAINER_TOAST }
  }

  return { kind: 'picker', parentId: input.sourceParentId }
}
