import type { JSX } from 'react'
import { DebouncedInput } from '@/ui/debounced-fields'
import { Field } from '@/ui/field'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function NumberField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <DebouncedInput
        key={`${nodeId}:${field.key}:${revision}`}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={text}
        placeholder={field.placeholder}
        onCommit={(next) => {
          if (next.trim() === '') {
            onChange(undefined)
            return
          }
          const parsed = Number(next)
          if (Number.isFinite(parsed)) onChange(parsed)
        }}
      />
    </Field>
  )
}
