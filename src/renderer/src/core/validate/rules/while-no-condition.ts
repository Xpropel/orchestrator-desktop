import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'

export function ruleWhileNoCondition(node: FlowNode, operator: OperatorDefinition): FlowIssue[] {
  if (operator.type !== 'while') return []
  const condition = node.data.form.condition
  if (typeof condition !== 'string' || condition.trim().length === 0) {
    return [issue('error', 'WHILE_NO_CONDITION', 'While 缺少循环条件', { nodeId: node.id, field: 'condition' })]
  }
  return []
}
