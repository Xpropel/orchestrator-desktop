import type { SelectHTMLAttributes, JSX } from 'react'
import { cn } from '@/ui/cn'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      className={cn(
        'h-8 w-full rounded-md border border-border bg-elevated px-2 text-sm text-primary',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
