import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput } from '@/ui/debounced-fields'
import { Select } from '@/ui/select'
import { Switch } from '@/ui/switch'
import { parseInputs } from '@/core/form-items'
import { isVarType, VAR_TYPES, type InputItem, type VarType } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

function rowId(item: InputItem, index: number): string {
  return item.id && item.id.length > 0 ? item.id : `input-${index}`
}

export function InputsField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const rows = parseInputs(value)

  const readLatest = (): InputItem[] =>
    parseInputs(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])

  const commit = (next: InputItem[]): void => {
    onChange(
      next.map((item, index) => ({
        id: rowId(item, index),
        key: item.key,
        type: item.type,
        required: item.required,
        description: item.description
      }))
    )
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-2">
        {rows.map((item, index) => {
          const id = rowId(item, index)
          return (
            <div key={id} className="rounded-md border border-border bg-elevated/50 p-2">
              <div className="mb-2 flex justify-end">
                <Button
                  variant="ghost"
                  className="px-1"
                  onClick={() =>
                    commit(readLatest().filter((entry, itemIndex) => rowId(entry, itemIndex) !== id))
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Field label="key">
                  <DebouncedInput
                    key={`${nodeId}:input:${id}:key:${revision}`}
                    value={item.key}
                    exists={() => readLatest().some((entry, itemIndex) => rowId(entry, itemIndex) === id)}
                    onCommit={(key) =>
                      commit(
                        readLatest().map((entry, itemIndex) =>
                          rowId(entry, itemIndex) === id ? { ...entry, id, key } : entry
                        )
                      )
                    }
                  />
                </Field>
                <Field label="类型">
                  <Select
                    value={item.type}
                    onChange={(event) => {
                      const type: VarType = isVarType(event.target.value) ? event.target.value : item.type
                      commit(
                        readLatest().map((entry, itemIndex) =>
                          rowId(entry, itemIndex) === id ? { ...entry, id, type } : entry
                        )
                      )
                    }}
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
                      commit(
                        readLatest().map((entry, itemIndex) =>
                          rowId(entry, itemIndex) === id ? { ...entry, id, required } : entry
                        )
                      )
                    }
                  />
                </Field>
                <Field label="描述">
                  <DebouncedInput
                    key={`${nodeId}:input:${id}:description:${revision}`}
                    value={item.description}
                    exists={() => readLatest().some((entry, itemIndex) => rowId(entry, itemIndex) === id)}
                    onCommit={(description) =>
                      commit(
                        readLatest().map((entry, itemIndex) =>
                          rowId(entry, itemIndex) === id ? { ...entry, id, description } : entry
                        )
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          )
        })}
        <Button
          onClick={() =>
            commit([
              ...readLatest(),
              { id: nanoid(8), key: '', type: 'string', required: false, description: '' }
            ])
          }
        >
          <Plus className="h-3 w-3" />
          添加入参
        </Button>
      </div>
    </Field>
  )
}
