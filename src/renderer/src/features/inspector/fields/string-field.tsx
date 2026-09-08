import type { JSX } from 'react'
import { DebouncedInput } from '@/ui/debounced-fields'
import { Field } from '@/ui/field'
import { asString } from '@/features/inspector/form-utils'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function StringField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <DebouncedInput
        key={`${nodeId}:${field.key}:${revision}`}
        value={asString(value)}
        placeholder={field.placeholder}
        onCommit={onChange}
      />
    </Field>
  )
}
