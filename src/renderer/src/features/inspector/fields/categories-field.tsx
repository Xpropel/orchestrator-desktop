import type { JSX } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput, DebouncedTextarea } from '@/ui/debounced-fields'
import { moveItem } from '@/features/inspector/form-utils'
import { parseCategories } from '@/core/form-items'
import type { CategoryItem } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function CategoriesField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const categories = parseCategories(value)

  const readLatest = (): CategoryItem[] =>
    parseCategories(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])

  const commit = (next: CategoryItem[]): void => {
    onChange(next)
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      <div className="flex flex-col gap-2">
        {categories.map((item, index) => (
          <div key={item.id} className="rounded-md border border-border bg-elevated/50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-secondary">
                Category {index + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  className="px-1"
                  disabled={index === 0}
                  onClick={() => commit(moveItem(readLatest(), index, -1))}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-1"
                  disabled={index === categories.length - 1}
                  onClick={() => commit(moveItem(readLatest(), index, 1))}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-1"
                  disabled={categories.length <= 1}
                  onClick={() => {
                    const latest = readLatest()
                    if (latest.length <= 1) return
                    commit(latest.filter((entry) => entry.id !== item.id))
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Field label="名称">
                <DebouncedInput
                  key={`${nodeId}:cat:${item.id}:name:${revision}`}
                  value={item.name}
                  exists={() => readLatest().some((entry) => entry.id === item.id)}
                  onCommit={(name) =>
                    commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, name } : entry)))
                  }
                />
              </Field>
              <Field label="描述">
                <DebouncedTextarea
                  key={`${nodeId}:cat:${item.id}:description:${revision}`}
                  className="min-h-[56px]"
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
          onClick={() => {
            const latest = readLatest()
            commit([...latest, { id: nanoid(8), name: `Category ${latest.length + 1}`, description: '' }])
          }}
        >
          <Plus className="h-3 w-3" />
          添加类别
        </Button>
      </div>
    </Field>
  )
}
