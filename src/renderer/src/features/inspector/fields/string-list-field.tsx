import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput } from '@/ui/debounced-fields'
import { asStringArray } from '@/features/inspector/form-utils'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function StringListField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const items = asStringArray(value)

  const readLatest = (): string[] =>
    asStringArray(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-1.5">
        {items.map((text, index) => (
          <div key={`${nodeId}:${field.key}:${index}`} className="flex items-center gap-1">
            <DebouncedInput
              key={`${nodeId}:${field.key}:${index}:${revision}`}
              value={text}
              exists={() => index < readLatest().length}
              onCommit={(next) => {
                const latest = readLatest()
                if (index >= latest.length) return
                const copy = latest.slice()
                copy[index] = next
                onChange(copy)
              }}
            />
            <Button
              variant="ghost"
              className="px-1"
              onClick={() => {
                const latest = readLatest()
                onChange(latest.filter((_, itemIndex) => itemIndex !== index))
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button onClick={() => onChange([...readLatest(), ''])}>
          <Plus className="h-3 w-3" />
          添加
        </Button>
      </div>
    </Field>
  )
}
