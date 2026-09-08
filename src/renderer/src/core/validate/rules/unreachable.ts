import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'

export function ruleUnreachable(
  node: FlowNode,
  operator: OperatorDefinition,
  startIds: string[],
  reachable: Set<string>
): FlowIssue[] {
  if (operator.constraints?.allowRoot === true) return []
  if (operator.kind === 'note' || operator.kind === 'loopStart') return []
  if (startIds.length > 0 && !reachable.has(node.id)) {
    return [issue('warning', 'UNREACHABLE', `节点从入口不可达：${node.data.name}`, { nodeId: node.id })]
  }
  return []
}
