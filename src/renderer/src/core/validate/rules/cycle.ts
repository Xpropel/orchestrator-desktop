import { detectTopLevelCycle } from '../../graph/traversal'
import type { FlowEdge, FlowNode } from '../../types'
import { issue, type FlowIssue } from '../issue'

export function ruleCycle(nodes: FlowNode[], edges: FlowEdge[]): FlowIssue[] {
  if (detectTopLevelCycle(nodes, edges)) {
    return [issue('error', 'CYCLE', '容器外存在环路')]
  }
  return []
}
