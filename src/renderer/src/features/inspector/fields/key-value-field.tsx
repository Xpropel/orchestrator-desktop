import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput } from '@/ui/debounced-fields'
import { parseKeyValueItems } from '@/core/form-items'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function KeyValueField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const items = parseKeyValueItems(value)

  const readLatest = () =>
    parseKeyValueItems(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])

  const commit = (next: ReturnType<typeof parseKeyValueItems>): void => {
    onChange(next)
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-1">
            <DebouncedInput
              key={`${nodeId}:${field.key}:${item.id}:key:${revision}`}
              value={item.key}
              placeholder="key"
              exists={() => readLatest().some((entry) => entry.id === item.id)}
              onCommit={(key) =>
                commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, key } : entry)))
              }
            />
            <DebouncedInput
              key={`${nodeId}:${field.key}:${item.id}:value:${revision}`}
              value={item.value}
              placeholder="value"
              exists={() => readLatest().some((entry) => entry.id === item.id)}
              onCommit={(nextValue) =>
                commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, value: nextValue } : entry)))
              }
            />
            <Button variant="ghost" className="px-1" onClick={() => commit(readLatest().filter((entry) => entry.id !== item.id))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button onClick={() => commit([...readLatest(), { id: nanoid(8), key: '', value: '' }])}>
          <Plus className="h-3 w-3" />
          添加
        </Button>
      </div>
    </Field>
  )
}
