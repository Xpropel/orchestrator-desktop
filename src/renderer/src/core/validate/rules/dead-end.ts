import type { FlowEdge, FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'
import { parentIdOf } from '../helpers'

export function ruleDeadEnd(node: FlowNode, operator: OperatorDefinition, edges: FlowEdge[]): FlowIssue[] {
  if ((operator.kind === 'task' || operator.kind === 'start') && !parentIdOf(node)) {
    const hasOut = edges.some((edge) => edge.source === node.id)
    if (!hasOut) {
      const label = operator.kind === 'start' ? '入口节点' : '任务节点'
      return [issue('warning', 'DEAD_END', `${label}没有出边：${node.data.name}`, { nodeId: node.id })]
    }
  }
  return []
}
