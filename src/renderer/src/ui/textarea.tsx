import type { TextareaHTMLAttributes, JSX } from 'react'
import { cn } from '@/ui/cn'

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      className={cn(
        'min-h-[72px] w-full resize-y rounded-md border border-border bg-elevated px-2 py-1.5 text-sm text-primary',
        'placeholder:text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
