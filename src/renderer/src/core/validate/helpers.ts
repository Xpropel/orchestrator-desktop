import { parentIdOf } from '../graph/parent-id'
import { logicalHandleId } from '../handles'
import { getOperator, hasOperator } from '../registry'
import type { OperatorDefinition } from '../schema'
import type { FlowEdge, FlowNode } from '../types'
import { lookupAvailableVariable, parseReferences } from '../variables'

export { parentIdOf }

export function operatorOf(node: FlowNode): OperatorDefinition | undefined {
  if (!hasOperator(node.data.label)) return undefined
  return getOperator(node.data.label)
}

/** 引用目标是否为任意 start 节点的 name（全局可引用）。 */
export function isStartNodeName(name: string, nodes: FlowNode[]): boolean {
  return nodes.some((node) => node.data.name === name && operatorOf(node)?.kind === 'start')
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function descendantsFromHandle(sourceId: string, handleId: string, edges: FlowEdge[]): Set<string> {
  const outgoing = new Map<string, { target: string; handle?: string | null }[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.source)
    const item = { target: edge.target, handle: edge.sourceHandle }
    if (list) list.push(item)
    else outgoing.set(edge.source, [item])
  }
  const seen = new Set<string>()
  const stack: string[] = []
  for (const edge of outgoing.get(sourceId) ?? []) {
    if ((logicalHandleId(edge.handle) ?? null) === handleId) stack.push(edge.target)
  }
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || seen.has(current)) continue
    seen.add(current)
    for (const edge of outgoing.get(current) ?? []) {
      stack.push(edge.target)
    }
  }
  return seen
}

export function sessionRefKey(value: unknown, knownNames?: Iterable<string>): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined
  const refs = parseReferences(value, knownNames)
  if (refs.length === 0) return value.trim()
  return `${refs[0]?.node}.${refs[0]?.variable}`
}

export function lookupAvailable<T extends { nodeName: string; variable: { name: string } }>(
  available: T[],
  refNode: string,
  refVar: string
): T | undefined {
  return lookupAvailableVariable(available, refNode, refVar)
}
