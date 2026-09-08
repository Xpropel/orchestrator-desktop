import { getKindForNodeType, getOperator, hasOperator } from '../registry'
import type { FlowNode } from '../types'
import type { NodeKind } from '../schema'

function kindOf(node: FlowNode): NodeKind | undefined {
  if (hasOperator(node.data.label)) {
    return getOperator(node.data.label).kind
  }
  return getKindForNodeType(node.type)
}

export function isStartNode(node: FlowNode): boolean {
  return kindOf(node) === 'start'
}

export function isLoopStartNode(node: FlowNode): boolean {
  return kindOf(node) === 'loopStart' || node.data.label === 'loop-start'
}

export function isContainerNode(node: FlowNode): boolean {
  return kindOf(node) === 'container'
}

/** loopStart 恒受保护；start 仅当它是画布上最后一个 start 时受保护。 */
export function isProtectedNode(node: FlowNode, nodes: FlowNode[]): boolean {
  if (isLoopStartNode(node)) return true
  if (!isStartNode(node)) return false
  return nodes.filter(isStartNode).length <= 1
}

/** 批量删除时不可去掉的 id：所有 loopStart；若会删光 start 则留下其中一个（优先 id 为 `start`）。 */
export function idsProtectedFromRemoval(nodes: FlowNode[], removingIds: Iterable<string>): Set<string> {
  const removing = new Set(removingIds)
  const protectedIds = new Set<string>()
  for (const node of nodes) {
    if (removing.has(node.id) && isLoopStartNode(node)) {
      protectedIds.add(node.id)
    }
  }
  const starts = nodes.filter(isStartNode)
  const remaining = starts.filter((node) => !removing.has(node.id))
  if (remaining.length === 0) {
    const doomed = starts.filter((node) => removing.has(node.id))
    const keep = doomed.find((node) => node.id === 'start') ?? doomed[0]
    if (keep) protectedIds.add(keep.id)
  }
  return protectedIds
}
