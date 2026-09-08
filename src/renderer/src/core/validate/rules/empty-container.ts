import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'
import { operatorOf, parentIdOf } from '../helpers'

export function ruleEmptyContainer(
  node: FlowNode,
  operator: OperatorDefinition,
  nodes: FlowNode[]
): FlowIssue[] {
  if (operator.kind !== 'container') return []
  const children = nodes.filter((item) => parentIdOf(item) === node.id)
  const realChildren = children.filter((item) => operatorOf(item)?.kind !== 'loopStart')
  if (realChildren.length === 0) {
    return [issue('warning', 'EMPTY_CONTAINER', `容器没有子节点：${node.data.name}`, { nodeId: node.id })]
  }
  return []
}
