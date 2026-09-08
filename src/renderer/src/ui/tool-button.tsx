import type { JSX, ReactNode } from 'react'
import { cn } from './cn'

export function ToolButton({
  children,
  onClick,
  'aria-label': ariaLabel,
  active,
  'data-testid': testId
}: {
  children: ReactNode
  onClick: () => void
  'aria-label'?: string
  active?: boolean
  'data-testid'?: string
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-primary',
        'hover:bg-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        active && 'bg-elevated text-accent'
      )}
    >
      {children}
    </button>
  )
}
