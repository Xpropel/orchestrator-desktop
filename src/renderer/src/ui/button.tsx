import type { ButtonHTMLAttributes, JSX } from 'react'
import { cn } from '@/ui/cn'

type ButtonVariant = 'default' | 'ghost' | 'danger'

export function Button({
  className,
  variant = 'default',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): JSX.Element {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50',
        variant === 'default' && 'bg-elevated text-primary hover:border-accent border border-border',
        variant === 'ghost' && 'text-primary hover:bg-elevated',
        variant === 'danger' &&
          'border border-red-500/40 text-red-400 hover:bg-red-500/10',
        className
      )}
      {...props}
    />
  )
}
