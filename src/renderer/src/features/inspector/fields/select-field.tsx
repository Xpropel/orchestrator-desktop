import type { JSX } from 'react'
import { Field } from '@/ui/field'
import { Select } from '@/ui/select'
import type { SchemaFieldProps } from '../field-types'

export function SelectField({ field, value, onChange }: SchemaFieldProps): JSX.Element {
  const current = value == null ? '' : String(value)
  const options = field.options ?? []
  const known = current.length === 0 || options.some((item) => String(item.value) === current)
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <Select
        value={current}
        onChange={(event) => {
          const raw = event.target.value
          const option = options.find((item) => String(item.value) === raw)
          onChange(option ? option.value : raw)
        }}
      >
        <option value="">（未选择）</option>
        {known ? null : <option value={current}>{`${current}（未知）`}</option>}
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}
