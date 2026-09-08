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

export function extensionIdentity(item: LibraryExtension): string {
  const cats = item.categories.map((category) => category.key).sort().join(',')
  if (cats) return `cat:${cats}`
  return `op:${item.operators.map((operator) => operator.type).sort().join(',')}`
}

/** 同一套扩展可能同时出现在 gitignore 目录和 `private/` 子模块里，只保留一份。 */
export function uniqueExtensions(list: LibraryExtension[]): LibraryExtension[] {
  const seen = new Set<string>()
  const out: LibraryExtension[] = []
  for (const item of list) {
    const key = extensionIdentity(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
