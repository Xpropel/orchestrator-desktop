import type { JSX } from 'react'
import { getOperator, hasOperator } from '@/core/registry'
import type { ParamFieldType } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import { useStableNode } from '@/state/select-node'
import { fieldVisible } from '@/core/form/field-visible'
import type { SchemaFieldProps } from './field-types'
import { AssignmentsField } from './fields/assignments-field'
import { BooleanField } from './fields/boolean-field'
import { CasesField } from './fields/cases-field'
import { CategoriesField } from './fields/categories-field'
import { CodeField } from './fields/code-field'
import { ExpressionField } from './fields/expression-field'
import { InputsField } from './fields/inputs-field'
import { JsonField } from './fields/json-field'
import { KeyValueField } from './fields/key-value-field'
import { ModelField } from './fields/model-field'
import { NumberField } from './fields/number-field'
import { SelectField } from './fields/select-field'
import { SliderField } from './fields/slider-field'
import { StringField } from './fields/string-field'
import { StringListField } from './fields/string-list-field'
import { TemplateField } from './fields/template-field'
import { TextField } from './fields/text-field'
import { VariableField } from './fields/variable-field'

const FIELD_RENDERERS: Record<ParamFieldType, (props: SchemaFieldProps) => JSX.Element> = {
  string: StringField,
  text: TextField,
  number: NumberField,
  boolean: BooleanField,
  select: SelectField,
  slider: SliderField,
  code: CodeField,
  json: JsonField,
  expression: ExpressionField,
  template: TemplateField,
  variable: VariableField,
  stringList: StringListField,
  keyValue: KeyValueField,
  cases: CasesField,
  categories: CategoriesField,
  inputs: InputsField,
  assignments: AssignmentsField,
  model: ModelField
}

export function SchemaForm({ nodeId }: { nodeId: string }): JSX.Element | null {
  const node = useStableNode(nodeId)
  const updateNodeForm = useFlowStore((state) => state.updateNodeForm)
  const replaceNodeForm = useFlowStore((state) => state.replaceNodeForm)

  if (!node || !hasOperator(node.data.label)) {
    return null
  }

  const operator = getOperator(node.data.label)
  const form = node.data.form

  return (
    <div className="flex flex-col gap-3">
      {operator.params.map((field) => {
        if (!fieldVisible(form, field)) return null
        const Renderer = FIELD_RENDERERS[field.type]
        return (
          <Renderer
            key={field.key}
            nodeId={nodeId}
            field={field}
            value={form[field.key]}
            form={form}
            onChange={(value) => updateNodeForm(nodeId, { [field.key]: value })}
            onReplaceForm={(next) => replaceNodeForm(nodeId, next)}
          />
        )
      })}
    </div>
  )
}
