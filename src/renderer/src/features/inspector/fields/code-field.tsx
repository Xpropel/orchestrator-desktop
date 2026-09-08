import type { JSX } from 'react'
import { DebouncedTextarea } from '@/ui/debounced-fields'
import { Field } from '@/ui/field'
import { asString } from '@/features/inspector/form-utils'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function CodeField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const language = typeof field.extra?.language === 'string' ? field.extra.language : undefined
  return (
    <Field
      label={`${field.label}${field.required ? ' *' : ''}`}
      hint={field.hint ?? (language ? `语言：${language}` : undefined)}
    >
      <DebouncedTextarea
        key={`${nodeId}:${field.key}:${revision}`}
        className="min-h-[140px] font-mono text-xs"
        spellCheck={false}
        value={asString(value)}
        placeholder={field.placeholder}
        onCommit={onChange}
      />
    </Field>
  )
}
