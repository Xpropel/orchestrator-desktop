import { getSourceHandles } from '../../registry'
import type { FlowEdge, FlowNode } from '../../types'
import { knownNodeNames } from '../../variables'
import { issue, type FlowIssue } from '../issue'
import { descendantsFromHandle, operatorOf, sessionRefKey } from '../helpers'

export function ruleSessionConcurrentWrite(nodes: FlowNode[], edges: FlowEdge[]): FlowIssue[] {
  const issues: FlowIssue[] = []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const knownNames = knownNodeNames(nodes)
  const branchNodes = nodes.filter((node) => operatorOf(node)?.kind === 'branch')
  for (const branch of branchNodes) {
    const handles = getSourceHandles(branch.data.label, branch.data.form)
    const writers: { nodeId: string; session: string; handle: string }[] = []
    for (const handle of handles) {
      const down = descendantsFromHandle(branch.id, handle.id, edges)
      for (const id of down) {
        const node = nodeMap.get(id)
        if (!node || operatorOf(node)?.type !== 'agent') continue
        const key = sessionRefKey(node.data.form.session, knownNames)
        if (!key) continue
        writers.push({ nodeId: node.id, session: key, handle: handle.id })
      }
    }
    const bySession = new Map<string, Set<string>>()
    for (const writer of writers) {
      const handlesFor = bySession.get(writer.session) ?? new Set<string>()
      handlesFor.add(writer.handle)
      bySession.set(writer.session, handlesFor)
    }
    for (const [session, handleSet] of bySession) {
      if (handleSet.size < 2) continue
      const involved = writers.filter((writer) => writer.session === session)
      for (const writer of involved) {
        issues.push(
          issue('warning', 'SESSION_CONCURRENT_WRITE', '同一会话被并行分支续写，应先 fork', {
            nodeId: writer.nodeId,
            field: 'session'
          })
        )
      }
    }
  }
  return issues
}
