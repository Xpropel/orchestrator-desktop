import type { FlowNode } from '../../types'
import { issue, type FlowIssue } from '../issue'
import { operatorOf } from '../helpers'

export function startNodesOf(nodes: FlowNode[]): FlowNode[] {
  return nodes.filter((node) => operatorOf(node)?.kind === 'start')
}

export function ruleNoStart(starts: FlowNode[]): FlowIssue[] {
  if (starts.length === 0) {
    return [issue('error', 'NO_START', '画布缺少 start 节点')]
  }
  return []
}
