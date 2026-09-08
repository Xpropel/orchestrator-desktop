import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput } from '@/ui/debounced-fields'
import { Select } from '@/ui/select'
import { Switch } from '@/ui/switch'
import { parseInputs } from '@/core/form-items'
import { VAR_TYPES, type InputItem, type VarType } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

interface InputRow extends InputItem {
  id: string
}

function withIds(items: InputItem[]): InputRow[] {
  return items.map((item, index) => ({
    ...item,
    id: item.key.length > 0 ? item.key : `input-${index}`
  }))
}

export function InputsField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const rows = withIds(parseInputs(value))

  const readLatest = (): InputRow[] =>
    withIds(parseInputs(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key]))

  const commit = (next: InputRow[]): void => {
    onChange(
      next.map(({ key, type, required, description }) => ({ key, type, required, description }))
    )
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-2">
        {rows.map((item) => (
          <div key={item.id} className="rounded-md border border-border bg-elevated/50 p-2">
            <div className="mb-2 flex justify-end">
              <Button
                variant="ghost"
                className="px-1"
                onClick={() => commit(readLatest().filter((entry) => entry.id !== item.id))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Field label="key">
                <DebouncedInput
                  key={`${nodeId}:input:${item.id}:key:${revision}`}
                  value={item.key}
                  exists={() => readLatest().some((entry) => entry.id === item.id)}
                  onCommit={(key) =>
                    commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, key } : entry)))
                  }
                />
              </Field>
              <Field label="类型">
                <Select
                  value={item.type}
                  onChange={(event) =>
                    commit(
                      readLatest().map((entry) =>
                        entry.id === item.id ? { ...entry, type: event.target.value as VarType } : entry
                      )
                    )
                  }
                >
                  {VAR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="必填">
                <Switch
                  checked={item.required}
                  onCheckedChange={(required) =>
                    commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, required } : entry)))
                  }
                />
              </Field>
              <Field label="描述">
                <DebouncedInput
                  key={`${nodeId}:input:${item.id}:description:${revision}`}
                  value={item.description}
                  exists={() => readLatest().some((entry) => entry.id === item.id)}
                  onCommit={(description) =>
                    commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, description } : entry)))
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <Button
          onClick={() =>
            commit([...readLatest(), { id: nanoid(8), key: '', type: 'string', required: false, description: '' }])
          }
        >
          <Plus className="h-3 w-3" />
          添加入参
        </Button>
      </div>
    </Field>
  )
}
