import type { JSX } from 'react'
import { Field } from '@/ui/field'
import { asString } from '@/features/inspector/form-utils'
import { acceptFromField, VariablePicker } from '../variable-picker'
import type { SchemaFieldProps } from '../field-types'

export function VariableField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <VariablePicker
        nodeId={nodeId}
        accept={acceptFromField(field)}
        value={asString(value)}
        onSelect={onChange}
      />
    </Field>
  )
}
