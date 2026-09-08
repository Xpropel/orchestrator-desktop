import type { ParamField } from '@/core/schema'

export interface SchemaFieldProps {
  nodeId: string
  field: ParamField
  value: unknown
  form: Record<string, unknown>
  onChange: (value: unknown) => void
  onReplaceForm?: (next: Record<string, unknown>) => void
}
