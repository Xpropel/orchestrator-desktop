import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput } from '@/ui/debounced-fields'
import { parseAssignments } from '@/core/form-items'
import type { AssignmentItem } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function AssignmentsField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const items = parseAssignments(value)

  const readLatest = (): AssignmentItem[] =>
    parseAssignments(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])

  const commit = (next: AssignmentItem[]): void => {
    onChange(next)
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-1">
            <DebouncedInput
              key={`${nodeId}:assign:${item.id}:variable:${revision}`}
              value={item.variable}
              placeholder="variable"
              exists={() => readLatest().some((entry) => entry.id === item.id)}
              onCommit={(variable) =>
                commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, variable } : entry)))
              }
            />
            <DebouncedInput
              key={`${nodeId}:assign:${item.id}:value:${revision}`}
              value={item.value}
              placeholder="{{Node.var}}"
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
        <Button onClick={() => commit([...readLatest(), { id: nanoid(8), variable: '', value: '' }])}>
          <Plus className="h-3 w-3" />
          添加赋值
        </Button>
      </div>
    </Field>
  )
}
