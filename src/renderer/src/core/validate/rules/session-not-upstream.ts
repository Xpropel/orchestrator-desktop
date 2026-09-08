import type { FlowIssue } from '../issue'
import { issue } from '../issue'

export function sessionNotUpstream(nodeId: string, field: string): FlowIssue {
  return issue('error', 'SESSION_NOT_UPSTREAM', '引用的会话不在当前节点上游', { nodeId, field })
}
