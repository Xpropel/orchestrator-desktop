import { issue, type FlowIssue } from '../issue'

export function missingRequired(nodeId: string, field: string, label: string): FlowIssue {
  return issue('error', 'MISSING_REQUIRED', `必填参数为空：${label}`, { nodeId, field })
}
