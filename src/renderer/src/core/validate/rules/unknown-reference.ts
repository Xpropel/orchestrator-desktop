import type { FlowIssue } from '../issue'
import { issue } from '../issue'

export function unknownReference(
  nodeId: string,
  message: string,
  field?: string
): FlowIssue {
  return issue('error', 'UNKNOWN_REFERENCE', message, field ? { nodeId, field } : { nodeId })
}
