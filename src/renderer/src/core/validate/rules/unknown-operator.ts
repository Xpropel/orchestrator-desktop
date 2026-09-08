import type { FlowNode } from '../../types'
import { issue, type FlowIssue } from '../issue'
import { operatorOf } from '../helpers'

export function ruleUnknownOperator(node: FlowNode): FlowIssue[] {
  if (operatorOf(node)) return []
  return [issue('error', 'UNKNOWN_OPERATOR', `未知算子类型：${node.data.label}`, { nodeId: node.id })]
}
