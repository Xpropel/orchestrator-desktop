import type { FlowEdge, FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { getAvailableVariables, knownNodeNames, lookupAvailableVariable, parseReferences } from '../../variables'
import { issue, type FlowIssue } from '../issue'

export function ruleForeachItemsNotArray(
  node: FlowNode,
  operator: OperatorDefinition,
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowIssue[] {
  if (operator.type !== 'foreach') return []
  const items = node.data.form.items
  if (typeof items !== 'string' || items.trim().length === 0) return []
  const refs = parseReferences(items, knownNodeNames(nodes))
  const available = getAvailableVariables(node.id, nodes, edges)
  const issues: FlowIssue[] = []
  for (const ref of refs) {
    const found = lookupAvailableVariable(available, ref.node, ref.variable)
    if (found && found.variable.type !== 'array' && found.variable.type !== 'any') {
      issues.push(
        issue('error', 'FOREACH_ITEMS_NOT_ARRAY', 'ForEach 的 items 必须是 array', {
          nodeId: node.id,
          field: 'items'
        })
      )
    }
  }
  return issues
}
