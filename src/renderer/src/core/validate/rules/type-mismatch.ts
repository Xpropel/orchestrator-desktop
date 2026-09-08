import type { FlowIssue } from '../issue'
import { issue } from '../issue'

export function typeMismatch(nodeId: string, field: string, actual: string, accept: string[]): FlowIssue {
  return issue('error', 'TYPE_MISMATCH', `类型不兼容：${actual} 不在 [${accept.join(', ')}]`, {
    nodeId,
    field
  })
}
