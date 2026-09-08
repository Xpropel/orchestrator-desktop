import type { JSX } from 'react'
import { DebouncedTextarea } from '@/ui/debounced-fields'
import { Field } from '@/ui/field'
import { asString } from '@/features/inspector/form-utils'
import { useFlowStore } from '@/state/flow-store'
import { InsertVariableButton } from '../variable-picker'
import { TemplatePreview } from '../template-preview'
import type { SchemaFieldProps } from '../field-types'

export function ExpressionField({ nodeId, field, value, onChange }: SchemaFieldProps): JSX.Element {
  const revision = useFlowStore((state) => state.revision)
  const text = asString(value)
  return (
    <Field
      label={`${field.label}${field.required ? ' *' : ''}`}
      hint={field.hint}
    >
      <div className="mb-1 flex justify-end">
        <InsertVariableButton
          nodeId={nodeId}
          onInsert={(ref) => onChange(text.length === 0 ? ref : `${text}${ref}`)}
        />
      </div>
      <DebouncedTextarea
        key={`${nodeId}:${field.key}:${revision}`}
        className="min-h-[72px] font-mono text-xs"
        value={text}
        placeholder={field.placeholder ?? '{{Node.var}} == 1'}
        onCommit={onChange}
      />
      <TemplatePreview text={text} />
    </Field>
  )
}
