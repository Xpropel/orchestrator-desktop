import { HANDLE_END, HANDLE_START, logicalHandleId } from '../handles'
import { getKindForNodeType, getOperator, getSourceHandles, getTargetHandles, hasOperator } from '../registry'
import type { FlowConnection, FlowEdge, FlowNode } from '../types'
import { isLoopStartNode, isStartNode } from './kind'
import { wouldCreateCycle } from './traversal'

function sourceHandleIdsOf(node: FlowNode): string[] {
  if (hasOperator(node.data.label)) {
    return getSourceHandles(node.data.label, node.data.form).map((handle) => handle.id)
  }
  const kind = getKindForNodeType(node.type)
  if (kind === 'note' || kind === 'end' || kind === 'break') {
    return []
  }
  return [HANDLE_START]
}

export function collectDanglingEdgeIds(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const dangling: string[] = []

  for (const edge of edges) {
    const source = nodeById.get(edge.source)
    if (!source) {
      dangling.push(edge.id)
      continue
    }

    const handles = sourceHandleIdsOf(source)
    const kind = hasOperator(source.data.label)
      ? getOperator(source.data.label).kind
      : getKindForNodeType(source.type)
    const isBranch = kind === 'branch'
    const rawHandle = edge.sourceHandle ?? (isBranch ? null : HANDLE_START)
    const handleId = rawHandle == null ? null : (logicalHandleId(rawHandle) ?? rawHandle)
    if (handleId === null || !handles.includes(handleId)) {
      dangling.push(edge.id)
    }
  }

  return dangling
}

/** 仓库里是否已有同一对端点（按逻辑 handle，忽略 `start#new` / `start#1`）。 */
export function hasMatchingConnection(
  edges: FlowEdge[],
  connection: Pick<FlowConnection, 'source' | 'sourceHandle' | 'target'>
): boolean {
  if (!connection.source || !connection.target) return false
  const handle = logicalHandleId(connection.sourceHandle) ?? HANDLE_START
  return edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (logicalHandleId(edge.sourceHandle) ?? HANDLE_START) === handle
  )
}

export function isDuplicateConnection(
  edges: FlowEdge[],
  connection: Pick<FlowConnection, 'source' | 'sourceHandle' | 'target'>
): boolean {
  return hasMatchingConnection(edges, connection)
}

/** 是否同属一个父容器。跨容器连线已允许，此函数只作归属判断。 */
export function sameContainerBoundary(source: FlowNode, target: FlowNode): boolean {
  return (source.parentId ?? null) === (target.parentId ?? null)
}

export function normalizeFlowConnection(nodes: FlowNode[], connection: FlowConnection): FlowConnection {
  const sourceHandle = logicalHandleId(connection.sourceHandle) ?? HANDLE_START
  let targetHandle = logicalHandleId(connection.targetHandle) ?? HANDLE_END

  const target = connection.target ? nodes.find((node) => node.id === connection.target) : undefined
  if (target && hasOperator(target.data.label)) {
    const allowed = getTargetHandles(target.data.label).map((handle) => handle.id)
    if (allowed.length > 0 && !allowed.includes(targetHandle)) {
      targetHandle = allowed[0] ?? HANDLE_END
    }
  } else if (targetHandle === HANDLE_START) {
    targetHandle = HANDLE_END
  }

  return { ...connection, sourceHandle, targetHandle }
}

export function normalizeStoredEdge(nodes: FlowNode[], edge: FlowEdge): FlowEdge {
  const normalized = normalizeFlowConnection(nodes, edge)
  if (normalized.sourceHandle === edge.sourceHandle && normalized.targetHandle === edge.targetHandle) {
    return edge
  }
  return { ...edge, sourceHandle: normalized.sourceHandle, targetHandle: normalized.targetHandle }
}

export function explainInvalidConnection(
  nodes: FlowNode[],
  edges: FlowEdge[],
  raw: FlowConnection
): string | null {
  const connection = normalizeFlowConnection(nodes, raw)
  if (!connection.source || !connection.target) return '不能连接：缺少端点'
  if (connection.source === connection.target) return '不能连接：不能连到自己'

  const source = nodes.find((node) => node.id === connection.source)
  const target = nodes.find((node) => node.id === connection.target)
  if (!source || !target) return '不能连接：缺少端点'

  const sourceKind = hasOperator(source.data.label)
    ? getOperator(source.data.label).kind
    : getKindForNodeType(source.type)
  const targetKind = hasOperator(target.data.label)
    ? getOperator(target.data.label).kind
    : getKindForNodeType(target.type)

  if (sourceKind === 'note' || targetKind === 'note') return '不能连接：便签不能连线'
  if (
    targetKind === 'start' ||
    targetKind === 'loopStart' ||
    isStartNode(target) ||
    isLoopStartNode(target)
  ) {
    return '不能连接：不能连到开始节点'
  }
  if (sourceKind === 'end' || sourceKind === 'break') return '不能连接：该节点没有出口'
  if (isDuplicateConnection(edges, connection)) return '不能连接：重复的连线'
  if (wouldCreateCycle(nodes, edges, connection)) return '不能连接：会形成环'
  return null
}

export function isValidFlowConnection(
  nodes: FlowNode[],
  edges: FlowEdge[],
  connection: FlowConnection
): boolean {
  return explainInvalidConnection(nodes, edges, connection) === null
}
