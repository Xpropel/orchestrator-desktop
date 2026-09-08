import type { FlowEdge, FlowNode } from '../../types'
import { issue, type FlowIssue } from '../issue'
import { parentIdOf } from '../helpers'

export function ruleCrossContainerEdge(nodes: FlowNode[], edges: FlowEdge[]): FlowIssue[] {
  const issues: FlowIssue[] = []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  for (const edge of edges) {
    const source = nodeMap.get(edge.source)
    const target = nodeMap.get(edge.target)
    if (!source || !target) continue
    const sourceParent = parentIdOf(source)
    const targetParent = parentIdOf(target)
    const sourceIsParentOfTarget = targetParent === source.id
    const targetIsParentOfSource = sourceParent === target.id
    if (sourceParent !== targetParent && !sourceIsParentOfTarget && !targetIsParentOfSource) {
      issues.push(
        issue('error', 'CROSS_CONTAINER_EDGE', '禁止跨容器边界连线', { edgeId: edge.id, nodeId: source.id })
      )
    }
  }
  return issues
}
