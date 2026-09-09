import { explainInvalidConnection } from '@/core/graph'
import { HANDLE_END, HANDLE_START, logicalHandleId } from '@/core/handles'
import { getTargetHandles, hasOperator } from '@/core/registry'
import type { FlowEdge, FlowNode, XYPosition } from '@/core/types'
import {
  dropLeavesContainer,
  findNoteAtPoint,
  isIgnoredConnectTarget,
  isSourceOrAncestor,
  pickDropTargetNode,
  pointHitsNode
} from '@/features/canvas/drop-target'

export type ConnectEndPlan =
  | { kind: 'none' }
  | { kind: 'toast'; message: string }
  | {
      kind: 'connect'
      connection: { source: string; sourceHandle: string; target: string; targetHandle: string }
    }
  | { kind: 'picker'; parentId: string | null }

/** RF 的 `connectionState.to` 有时停在容器外，指针其实还在体内：用指针决定是否离盒。 */
export function resolveConnectEndPoint(
  snapped: XYPosition | null | undefined,
  pointer: XYPosition,
  nodes: FlowNode[],
  sourceId: string
): XYPosition {
  const snappedOk =
    snapped && Number.isFinite(snapped.x) && Number.isFinite(snapped.y) ? snapped : null
  if (!snappedOk) return pointer
  // 指针与 RF 的 to 对“是否离盒”看法不一致时，以指针为准（进盒 / 出盒都会过时）。
  if (dropLeavesContainer(snappedOk, nodes, sourceId) !== dropLeavesContainer(pointer, nodes, sourceId)) {
    return pointer
  }
  if (findNoteAtPoint(pointer, nodes) && !findNoteAtPoint(snappedOk, nodes)) {
    return pointer
  }
  const pointerHit = pickDropTargetNode(pointer, nodes, sourceId)
  const snappedHit = pickDropTargetNode(snappedOk, nodes, sourceId)
  if (pointerHit && pointerHit.id !== snappedHit?.id) {
    return pointer
  }
  return snappedOk
}

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
  toHandleNodeId?: string | null
  alreadyConnected?: boolean
}): ConnectEndPlan {
  const noteHit = findNoteAtPoint(input.point, input.nodes)
  if (noteHit) {
    return { kind: 'toast', message: '不能连接：便签不能连线' }
  }

  const picked = pickDropTargetNode(input.point, input.nodes, input.sourceId)
  // 入口 handle 可以连到祖先容器（是否合法交给 explainInvalidConnection）。
  // 体内空白仍把父容器当空地，不走 toNode 回退。
  const handleNode =
    input.toHandleNodeId && input.toHandleNodeId !== input.sourceId
      ? input.nodes.find((node) => node.id === input.toHandleNodeId)
      : undefined
  const fallback =
    input.toNodeId && !isSourceOrAncestor(input.nodes, input.sourceId, input.toNodeId)
      ? input.nodes.find((node) => node.id === input.toNodeId)
      : undefined
  const hit =
    (handleNode && !isIgnoredConnectTarget(handleNode) ? handleNode : undefined) ??
    picked ??
    (fallback && !isIgnoredConnectTarget(fallback) ? fallback : undefined)

  // RF 的 toNode 经常是父容器（点在子节点或体内空白上）。alreadyConnected
  // 不得一律取消：只有 RF 报的落点（toHandle / toNode）就是这次命中时才跳过。
  if (
    hit &&
    input.alreadyConnected &&
    (input.toHandleNodeId === hit.id || input.toNodeId === hit.id)
  ) {
    return { kind: 'none' }
  }

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

  // 松在起点自身（含点了一下 + 出口）是取消。子节点叠在容器框内，必须先命中更深的落点。
  if (pointHitsNode(input.point, input.nodes, input.sourceId)) return { kind: 'none' }

  if (dropLeavesContainer(input.point, input.nodes, input.sourceId)) {
    return { kind: 'picker', parentId: null }
  }

  return { kind: 'picker', parentId: input.sourceParentId }
}
