import type { OperatorCategory, OperatorDefinition } from '../schema'
import type { FlowEdge, FlowNode } from '../types'
import type { FlowIssue } from '../validate/issue'

export interface ExtensionRuleContext {
  nodes: FlowNode[]
  edges: FlowEdge[]
  globals: Record<string, unknown>
  getOperator: (type: string) => OperatorDefinition | undefined
}

/** Extra validation rules run together with the core rules. */
export type ExtensionRule = (context: ExtensionRuleContext) => FlowIssue[]

export interface GlobalsField {
  key: string
  label: string
  hint?: string
}

/** Groups rendered by the flow-settings panel for `globals.<key>`. */
export interface GlobalsSection {
  key: string
  title: string
  fields: GlobalsField[]
}

export interface LibraryExtension {
  categories: OperatorCategory[]
  operators: OperatorDefinition[]
  /** Extra validation rules run together with the core rules. */
  rules?: ExtensionRule[]
  /** Groups rendered by the flow-settings panel for `globals.<key>`. */
  globals?: GlobalsSection[]
}
