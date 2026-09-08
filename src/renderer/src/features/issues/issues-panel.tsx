import type { JSX } from 'react'
import { useValidationStore } from '@/state/validation-store'
import { useFlowStore } from '@/state/flow-store'
import type { FlowIssue } from '@/core/validate'
import { cn } from '@/ui/cn'

function focusIssue(issue: FlowIssue): void {
  if (!issue.nodeId) return
  useFlowStore.getState().selectNode(issue.nodeId)
  window.dispatchEvent(new CustomEvent('flow:focus-node', { detail: { nodeId: issue.nodeId } }))
}

function IssueRow({ issue }: { issue: FlowIssue }): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-elevated',
        issue.level === 'error' ? 'text-red-400' : 'text-amber-400'
      )}
      onClick={() => focusIssue(issue)}
    >
      <span className="shrink-0 font-mono text-[10px] uppercase">{issue.level}</span>
      <span className="min-w-0 flex-1">
        <span className="mr-1.5 font-mono text-[10px] text-secondary">{issue.code}</span>
        {issue.message}
      </span>
    </button>
  )
}

export function IssuesPanel(): JSX.Element {
  const issues = useValidationStore((state) => state.issues)
  const errorCount = useValidationStore((state) => state.errorCount)
  const warningCount = useValidationStore((state) => state.warningCount)
  const errors = issues.filter((item) => item.level === 'error')
  const warnings = issues.filter((item) => item.level === 'warning')

  return (
    <section className="flex h-40 shrink-0 flex-col border-t border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <span className="font-medium uppercase tracking-wide text-secondary">问题</span>
        <span className="text-red-400">{errorCount} error</span>
        <span className="text-amber-400">{warningCount} warning</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {issues.length === 0 ? (
          <p className="px-2 py-2 text-xs text-secondary">没有问题</p>
        ) : (
          <>
            {errors.length > 0 ? (
              <div>
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-red-400">Error</p>
                {errors.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div>
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-400">Warning</p>
                {warnings.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
