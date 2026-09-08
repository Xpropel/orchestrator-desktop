import type { JSX } from 'react'
import { splitTemplateSegments } from './form-utils'

export function TemplatePreview({ text }: { text: string }): JSX.Element | null {
  if (!text.includes('{{')) return null
  const segments = splitTemplateSegments(text)
  return (
    <p className="mt-1 whitespace-pre-wrap break-all rounded-md bg-elevated/60 px-2 py-1 font-mono text-[11px] leading-relaxed text-secondary">
      {segments.map((segment, index) =>
        segment.kind === 'ref' ? (
          <span key={`${segment.value}:${index}`} className="rounded-sm bg-accent/15 text-accent">
            {segment.value}
          </span>
        ) : (
          <span key={`${index}:${segment.value.slice(0, 8)}`}>{segment.value}</span>
        )
      )}
    </p>
  )
}
