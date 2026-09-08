import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput } from '@/ui/debounced-fields'
import { asStringArray } from '@/features/inspector/form-utils'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function StringListField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const items = asStringArray(value)
  const rows = items.map((text, index) => ({ id: `${nodeId}:${field.key}:${index}:${text}`, text }))

  const commitById = (rowId: string, nextText: string): void => {
    const latest = asStringArray(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])
    const currentRows = latest.map((text, index) => ({ id: `${nodeId}:${field.key}:${index}:${text}`, text }))
    onChange(currentRows.map((row) => (row.id === rowId ? nextText : row.text)))
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-1.5">
        {items.map((text, index) => {
          const id = rows[index]?.id ?? nanoid(8)
          return (
            <div key={id} className="flex items-center gap-1">
              <DebouncedInput
                key={`${id}:${revision}`}
                value={text}
                onCommit={(next) => commitById(id, next)}
              />
              <Button
                variant="ghost"
                className="px-1"
                onClick={() => {
                  const latest = asStringArray(
                    useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key]
                  )
                  const currentRows = latest.map((entry, itemIndex) => ({
                    id: `${nodeId}:${field.key}:${itemIndex}:${entry}`,
                    text: entry
                  }))
                  onChange(currentRows.filter((row) => row.id !== id).map((row) => row.text))
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
        <Button onClick={() => onChange([...items, ''])}>
          <Plus className="h-3 w-3" />
          添加
        </Button>
      </div>
    </Field>
  )
}
