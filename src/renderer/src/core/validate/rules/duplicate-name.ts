import type { FlowNode } from '../../types'
import { issue, type FlowIssue } from '../issue'

export function ruleDuplicateName(nodes: FlowNode[]): FlowIssue[] {
  const issues: FlowIssue[] = []
  const nameCounts = new Map<string, FlowNode[]>()
  for (const node of nodes) {
    const name = node.data.name.trim()
    const list = nameCounts.get(name)
    if (list) list.push(node)
    else nameCounts.set(name, [node])
  }
  for (const [name, group] of nameCounts) {
    if (!name || group.length < 2) continue
    for (const node of group) {
      issues.push(issue('error', 'DUPLICATE_NAME', `节点名称重复：${name}`, { nodeId: node.id, field: 'name' }))
    }
  }
  return issues
}
