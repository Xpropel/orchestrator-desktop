import { HANDLE_START, isLogicalStartHandle, logicalHandleId } from '../handles'
import type { FlowEdge } from '../types'

export function outgoingGroupKey(edge: FlowEdge): string {
  return `${edge.source}\0${logicalHandleId(edge.sourceHandle) ?? HANDLE_START}`
}

export function outgoingStartEdges(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((edge) => edge.source === nodeId && isLogicalStartHandle(edge.sourceHandle))
}

/** 在同一 `(source, sourceHandle)` 组内重排，其它边的相对位置不变。 */
export function reorderOutgoingEdges(edges: FlowEdge[], edgeId: string, toIndex: number): FlowEdge[] {
  const target = edges.find((edge) => edge.id === edgeId)
  if (!target) return edges
  const key = outgoingGroupKey(target)
  const slots: number[] = []
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index]
    if (edge && outgoingGroupKey(edge) === key) slots.push(index)
  }
  const fromSlot = slots.findIndex((index) => edges[index]?.id === edgeId)
  if (fromSlot < 0 || slots.length === 0) return edges
  const clamped = Math.max(0, Math.min(Math.trunc(toIndex), slots.length - 1))
  if (fromSlot === clamped) return edges

  const group = slots.map((index) => edges[index]!)
  const [moved] = group.splice(fromSlot, 1)
  if (!moved) return edges
  group.splice(clamped, 0, moved)

  const next = edges.slice()
  for (let slot = 0; slot < slots.length; slot += 1) {
    next[slots[slot]!] = group[slot]!
  }
  return next
}
