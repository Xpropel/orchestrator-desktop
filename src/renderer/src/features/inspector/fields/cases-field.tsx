import type { JSX } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput, DebouncedTextarea } from '@/ui/debounced-fields'
import { moveItem } from '@/features/inspector/form-utils'
import { parseCases } from '@/core/form-items'
import type { CaseItem } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

export function CasesField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const cases = parseCases(value)

  const readLatest = (): CaseItem[] =>
    parseCases(useFlowStore.getState().nodes.find((node) => node.id === nodeId)?.data.form[field.key])

  const commit = (next: CaseItem[]): void => {
    onChange(next)
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint ?? '未命中任何条件时走 Else'}>
      <div className="flex flex-col gap-2">
        {cases.map((item, index) => (
          <div key={item.id} className="rounded-md border border-border bg-elevated/50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-secondary">
                Case {index + 1}
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
                  disabled={index === cases.length - 1}
                  onClick={() => commit(moveItem(readLatest(), index, 1))}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-1"
                  disabled={cases.length <= 1}
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
              <Field label="标签">
                <DebouncedInput
                  key={`${nodeId}:case:${item.id}:label:${revision}`}
                  value={item.label}
                  exists={() => readLatest().some((entry) => entry.id === item.id)}
                  onCommit={(label) =>
                    commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, label } : entry)))
                  }
                />
              </Field>
              <Field label="表达式">
                <DebouncedTextarea
                  key={`${nodeId}:case:${item.id}:expression:${revision}`}
                  className="min-h-[56px] font-mono text-xs"
                  value={item.expression}
                  exists={() => readLatest().some((entry) => entry.id === item.id)}
                  onCommit={(expression) =>
                    commit(readLatest().map((entry) => (entry.id === item.id ? { ...entry, expression } : entry)))
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <Button
          onClick={() => {
            const latest = readLatest()
            commit([...latest, { id: nanoid(8), label: `Case ${latest.length + 1}`, expression: '' }])
          }}
        >
          <Plus className="h-3 w-3" />
          添加条件
        </Button>
      </div>
    </Field>
  )
}
