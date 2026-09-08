import { useEffect, useState, type JSX } from 'react'
import { Field } from '@/ui/field'
import { Textarea } from '@/ui/textarea'
import { cn } from '@/ui/cn'
import { useFlowStore } from '@/state/flow-store'
import type { SchemaFieldProps } from '../field-types'

function stringifyJson(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function JsonField({
  nodeId,
  field,
  value,
  form,
  onChange,
  onReplaceForm
}: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const replaceForm = field.extra?.replaceForm === true
  const snapshot = stringifyJson(replaceForm ? form : value)
  const [text, setText] = useState(snapshot)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setText(snapshot)
    setInvalid(false)
  }, [snapshot, nodeId, revision])

  const commit = (raw: string): void => {
    if (raw.trim() === '') {
      setInvalid(false)
      if (replaceForm && onReplaceForm) {
        onReplaceForm({})
        return
      }
      onChange(undefined)
      return
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setInvalid(true)
        return
      }
      setInvalid(false)
      if (replaceForm && onReplaceForm) {
        onReplaceForm(parsed as Record<string, unknown>)
        return
      }
      onChange(parsed)
    } catch {
      setInvalid(true)
    }
  }

  return (
    <Field
      label={`${field.label}${field.required ? ' *' : ''}`}
      hint={field.hint ?? '失焦时校验，非法 JSON 不会写回'}
      error={invalid ? 'JSON 无法解析或不是对象' : undefined}
    >
      <Textarea
        key={`${nodeId}:${field.key}:${revision}`}
        className={cn('min-h-[160px] font-mono text-xs', invalid && 'border-red-500 ring-1 ring-red-500')}
        spellCheck={false}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setInvalid(false)
        }}
        onBlur={() => commit(text)}
      />
    </Field>
  )
}
