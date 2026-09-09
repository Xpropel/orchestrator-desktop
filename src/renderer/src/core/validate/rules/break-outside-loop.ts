import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'
import { operatorOf, parentIdOf } from '../helpers'

export function ruleBreakOutsideLoop(
  node: FlowNode,
  operator: OperatorDefinition,
  nodes: FlowNode[]
): FlowIssue[] {
  if (operator.kind !== 'break') return []
  const parentId = parentIdOf(node)
  // 必须是当前图里还活着的节点，且算子 kind 为 container（ghost id / agent / loop-start 都不算）。
  const parent = parentId ? nodes.find((item) => item.id === parentId) : undefined
  if (!parent || operatorOf(parent)?.kind !== 'container') {
    return [issue('error', 'BREAK_OUTSIDE_LOOP', 'break 只能放在循环容器内部', { nodeId: node.id })]
  }
  return []
}
