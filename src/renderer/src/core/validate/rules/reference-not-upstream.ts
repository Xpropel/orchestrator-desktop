import type { FlowIssue } from '../issue'
import { issue } from '../issue'

export function referenceNotUpstream(nodeId: string, token: string, field?: string): FlowIssue {
  return issue(
    'error',
    'REFERENCE_NOT_UPSTREAM',
    `引用了不在上游的节点：${token}`,
    field ? { nodeId, field } : { nodeId }
  )
}
