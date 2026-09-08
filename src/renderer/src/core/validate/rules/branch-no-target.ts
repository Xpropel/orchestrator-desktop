import { getSourceHandles } from '../../registry'
import type { FlowEdge, FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'

export function ruleBranchNoTarget(
  node: FlowNode,
  operator: OperatorDefinition,
  edges: FlowEdge[]
): FlowIssue[] {
  if (operator.kind !== 'branch') return []
  const issues: FlowIssue[] = []
  const handles = getSourceHandles(operator.type, node.data.form)
  for (const handle of handles) {
    const hasTarget = edges.some((edge) => edge.source === node.id && (edge.sourceHandle ?? null) === handle.id)
    if (!hasTarget) {
      issues.push(
        issue('warning', 'BRANCH_NO_TARGET', `分支 ${handle.label} 没有出边`, {
          nodeId: node.id,
          field: handle.id
        })
      )
    }
  }
  return issues
}
