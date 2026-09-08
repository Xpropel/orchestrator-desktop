export type IssueLevel = 'error' | 'warning'

export interface FlowIssue {
  id: string
  level: IssueLevel
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  field?: string
}

export function issue(
  level: IssueLevel,
  code: string,
  message: string,
  extra: Pick<FlowIssue, 'nodeId' | 'edgeId' | 'field'> = {}
): FlowIssue {
  const id = [code, extra.nodeId ?? '', extra.edgeId ?? '', extra.field ?? '', message].join(':')
  return { id, level, code, message, ...extra }
}
