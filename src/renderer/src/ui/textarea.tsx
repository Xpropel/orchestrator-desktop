import { forwardRef, type JSX, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/ui/cn'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref): JSX.Element {
    return (
      <textarea
        ref={ref}
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
)
