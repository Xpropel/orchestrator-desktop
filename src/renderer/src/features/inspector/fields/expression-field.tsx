import { useEffect, useRef, type JSX } from 'react'
import { DebouncedTextarea } from '@/ui/debounced-fields'
import { Field } from '@/ui/field'
import { asString, insertAtCaret } from '@/features/inspector/form-utils'
import { useFlowStore } from '@/state/flow-store'
import { InsertVariableButton } from '../variable-picker'
import { TemplatePreview } from '../template-preview'
import type { SchemaFieldProps } from '../field-types'

export function ExpressionField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const text = asString(value)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const localRef = useRef(text)
  useEffect(() => {
    localRef.current = text
  }, [nodeId, field.key, revision])

  return (
    <Field
      label={`${field.label}${field.required ? ' *' : ''}`}
      hint={field.hint}
    >
      <div className="mb-1 flex justify-end">
        <InsertVariableButton
          nodeId={nodeId}
          onInsert={(ref) => {
            const el = areaRef.current
            const current = localRef.current
            const start = el?.selectionStart ?? current.length
            const end = el?.selectionEnd ?? current.length
            const { next, caret } = insertAtCaret(current, ref, start, end)
            localRef.current = next
            onChange(next)
            requestAnimationFrame(() => {
              el?.focus()
              el?.setSelectionRange(caret, caret)
            })
          }}
        />
      </div>
      <DebouncedTextarea
        ref={areaRef}
        key={`${nodeId}:${field.key}:${revision}`}
        className="min-h-[72px] font-mono text-xs"
        value={text}
        placeholder={field.placeholder ?? '{{Node.var}} == 1'}
        onLocalChange={(next) => {
          localRef.current = next
        }}
        onCommit={onChange}
      />
      <TemplatePreview text={text} />
    </Field>
  )
}
