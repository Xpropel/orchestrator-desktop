import type { LabelHTMLAttributes, JSX } from 'react'
import { cn } from '@/ui/cn'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  return (
    <label className={cn('text-xs font-medium text-secondary', className)} {...props} />
  )
}
