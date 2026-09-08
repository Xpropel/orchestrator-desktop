import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { issue, type FlowIssue } from '../issue'

export function ruleAgentNoModel(node: FlowNode, operator: OperatorDefinition): FlowIssue[] {
  if (operator.type !== 'agent') return []
  const session = node.data.form.session
  const model = node.data.form.model
  const hasSession = typeof session === 'string' && session.trim().length > 0
  const hasModel = typeof model === 'string' && model.trim().length > 0
  if (hasSession || hasModel) return []
  return [issue('error', 'AGENT_NO_MODEL', 'agent 既未挂会话也未填写 model', { nodeId: node.id, field: 'model' })]
}
