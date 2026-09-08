import type { JSX } from 'react'
import { Field } from '@/ui/field'
import { Switch } from '@/ui/switch'
import { asBoolean } from '@/features/inspector/form-utils'
import type { SchemaFieldProps } from '../field-types'

export function BooleanField({ field, value, onChange }: SchemaFieldProps): JSX.Element {
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <Switch checked={asBoolean(value)} onCheckedChange={onChange} />
    </Field>
  )
}
