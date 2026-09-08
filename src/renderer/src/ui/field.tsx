import type { JSX, ReactNode } from 'react'
import { Label } from './label'

export function Field({
  label,
  hint,
  error,
  children
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-secondary">{hint}</p> : null}
      {error ? <p className="text-[11px] leading-snug text-red-400">{error}</p> : null}
    </div>
  )
}
