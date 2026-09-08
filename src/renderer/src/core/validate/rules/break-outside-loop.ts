import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'
import { parentIdOf } from '../helpers'

export function ruleBreakOutsideLoop(node: FlowNode, operator: OperatorDefinition): FlowIssue[] {
  if (operator.kind === 'break' && !parentIdOf(node)) {
    return [issue('error', 'BREAK_OUTSIDE_LOOP', 'break 只能放在循环容器内部', { nodeId: node.id })]
  }
  return []
}
