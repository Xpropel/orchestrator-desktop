import { memo, type JSX } from 'react'
import { cn } from '@/ui/cn'
import { selectNodeIssues, useValidationStore } from '@/state/validation-store'

export const NodeIssueBadge = memo(function NodeIssueBadge({
  nodeId
}: {
  nodeId: string
}): JSX.Element | null {
  const issues = useValidationStore((state) => selectNodeIssues(state, nodeId))
  if (issues.length === 0) return null
  const errors = issues.filter((issue) => issue.level === 'error').length
  const warnings = issues.filter((issue) => issue.level === 'warning').length
  const count = errors > 0 ? errors : warnings
  if (count === 0) return null

  // 有错误时徽标计错误数（红），否则计警告数（琥珀）；完整数量放在悬停提示里。
  return (
    <span
      data-testid={`node-issue-badge-${nodeId}`}
      title={`${errors} 个错误 · ${warnings} 个警告`}
      className={cn(
        'absolute -right-1.5 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white shadow',
        errors > 0 ? 'bg-red-500' : 'bg-amber-400 text-amber-950'
      )}
    >
      {count}
    </span>
  )
})
