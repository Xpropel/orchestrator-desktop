import type { FlowIssue } from '../issue'
import { issue } from '../issue'

export function sessionTypeMismatch(nodeId: string, field: string): FlowIssue {
  return issue('error', 'SESSION_TYPE_MISMATCH', 'session 字段引用的变量类型不是 session', {
    nodeId,
    field
  })
}
