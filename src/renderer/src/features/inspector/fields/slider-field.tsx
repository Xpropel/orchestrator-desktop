import type { ChangeEvent, JSX } from 'react'
import { Field } from '@/ui/field'
import { asNumber, clampNumber } from '@/features/inspector/form-utils'
import type { SchemaFieldProps } from '../field-types'

export function SliderField({ field, value, onChange }: SchemaFieldProps): JSX.Element {
  const min = field.min ?? 0
  const max = field.max ?? 1
  const step = field.step ?? 0.1
  const current = clampNumber(
    asNumber(value, typeof field.default === 'number' ? field.default : min),
    min,
    max
  )
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
          className="h-8 flex-1 accent-accent"
        />
        <span className="w-10 text-right text-xs tabular-nums text-primary">{current}</span>
      </div>
    </Field>
  )
}
