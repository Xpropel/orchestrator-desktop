import { create } from 'zustand'
import type { FlowIssue } from '@/core/validate'

interface ValidationState {
  issues: FlowIssue[]
  issuesByNode: Record<string, FlowIssue[]>
  errorCount: number
  warningCount: number
  setIssues: (issues: FlowIssue[]) => void
}

function indexIssues(issues: FlowIssue[]): Pick<ValidationState, 'issuesByNode' | 'errorCount' | 'warningCount'> {
  const issuesByNode: Record<string, FlowIssue[]> = {}
  let errorCount = 0
  let warningCount = 0
  for (const item of issues) {
    if (item.level === 'error') errorCount += 1
    else warningCount += 1
    if (!item.nodeId) continue
    const list = issuesByNode[item.nodeId]
    if (list) list.push(item)
    else issuesByNode[item.nodeId] = [item]
  }
  return { issuesByNode, errorCount, warningCount }
}

const EMPTY_ISSUES: FlowIssue[] = []

export function selectNodeIssues(state: ValidationState, nodeId: string): FlowIssue[] {
  return state.issuesByNode[nodeId] ?? EMPTY_ISSUES
}

export const useValidationStore = create<ValidationState>((set) => ({
  issues: [],
  issuesByNode: {},
  errorCount: 0,
  warningCount: 0,
  setIssues: (issues) => {
    set({ issues, ...indexIssues(issues) })
  }
}))
