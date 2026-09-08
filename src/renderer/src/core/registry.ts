import { nanoid } from 'nanoid'
import { deepClone } from './clone'
import { parseCases, parseCategories } from './form-items'
import { HANDLE_APPROVED, HANDLE_ELSE, HANDLE_END, HANDLE_REJECTED, HANDLE_START } from './handles'
import type { NodeKind, OperatorCategory, OperatorDefinition, OperatorLibrary, ParamField } from './schema'
import type { FlowNodeType } from './types'

interface SourceHandle {
  id: string
  label: string
}

let library: OperatorLibrary = { version: 1, categories: [], operators: [] }
const operatorByType = new Map<string, OperatorDefinition>()

function rebuildIndex(): void {
  operatorByType.clear()
  for (const operator of library.operators) {
    operatorByType.set(operator.type, operator)
  }
}

export function registerLibrary(lib: OperatorLibrary): void {
  library = {
    version: 1,
    categories: lib.categories.map((category) => ({ ...category })),
    operators: lib.operators.map((operator) => ({
      ...operator,
      params: operator.params.map((field) => ({ ...field })),
      outputs: operator.outputs.map((output) => ({ ...output })),
      scopeVariables: operator.scopeVariables?.map((variable) => ({ ...variable })),
      constraints: operator.constraints ? { ...operator.constraints } : undefined
    }))
  }
  rebuildIndex()
}

export function getOperator(type: string): OperatorDefinition {
  const operator = operatorByType.get(type)
  if (!operator) {
    throw new Error(`Unknown operator type: ${type}`)
  }
  return operator
}

export function hasOperator(type: string): boolean {
  return operatorByType.has(type)
}

export function listOperators(): OperatorDefinition[] {
  return [...library.operators]
}

export function listCategories(): OperatorCategory[] {
  return [...library.categories].sort((a, b) => a.order - b.order)
}

export function getCategory(key: string): OperatorCategory | undefined {
  return library.categories.find((category) => category.key === key)
}

export function listOperatorsByCategory(key: string): OperatorDefinition[] {
  return library.operators.filter((operator) => operator.category === key)
}

function cloneDefault(value: unknown): unknown {
  if (value === undefined) return undefined
  return deepClone(value)
}

function defaultForField(field: ParamField): unknown {
  if (field.type === 'cases') {
    const raw = Array.isArray(field.default) ? field.default : []
    if (raw.length === 0) {
      return [{ id: nanoid(8), label: 'Case 1', expression: '' }]
    }
    return cloneDefault(raw)
  }
  if (field.type === 'categories') {
    const raw = Array.isArray(field.default) ? field.default : []
    if (raw.length === 0) {
      return [{ id: nanoid(8), name: 'Category 1', description: '' }]
    }
    return cloneDefault(raw)
  }
  if (field.default !== undefined) {
    return cloneDefault(field.default)
  }
  return undefined
}

export function getDefaultForm(type: string): Record<string, unknown> {
  const operator = getOperator(type)
  const form: Record<string, unknown> = {}
  for (const field of operator.params) {
    const value = defaultForField(field)
    if (value !== undefined) {
      form[field.key] = value
    }
  }
  return form
}

const KIND_TO_NODE_TYPE: Record<NodeKind, FlowNodeType> = {
  start: 'startNode',
  end: 'endNode',
  task: 'taskNode',
  branch: 'branchNode',
  container: 'containerNode',
  loopStart: 'loopStartNode',
  break: 'breakNode',
  note: 'noteNode'
}

const NODE_TYPE_TO_KIND = Object.fromEntries(
  Object.entries(KIND_TO_NODE_TYPE).map(([kind, type]) => [type, kind])
) as Record<FlowNodeType, NodeKind>

export function getNodeTypeForKind(kind: NodeKind): FlowNodeType {
  return KIND_TO_NODE_TYPE[kind]
}

export function getKindForNodeType(type: string | undefined): NodeKind | undefined {
  if (!type) return undefined
  return NODE_TYPE_TO_KIND[type as FlowNodeType]
}

export function getSourceHandles(type: string, form: Record<string, unknown>): SourceHandle[] {
  const operator = getOperator(type)
  if (operator.kind === 'end' || operator.kind === 'break' || operator.kind === 'note') {
    return []
  }
  if (type === 'approval') {
    return [
      { id: HANDLE_APPROVED, label: HANDLE_APPROVED },
      { id: HANDLE_REJECTED, label: HANDLE_REJECTED }
    ]
  }
  if (operator.kind === 'branch') {
    const handles: SourceHandle[] = []
    for (const item of parseCases(form.cases)) {
      handles.push({ id: item.id, label: item.label || item.id })
    }
    for (const item of parseCategories(form.categories)) {
      handles.push({ id: item.id, label: item.name || item.id })
    }
    if (operator.constraints?.hasElseBranch) {
      handles.push({ id: HANDLE_ELSE, label: HANDLE_ELSE })
    }
    return handles
  }
  if (
    operator.kind === 'task' ||
    operator.kind === 'container' ||
    operator.kind === 'loopStart' ||
    operator.kind === 'start'
  ) {
    return [{ id: HANDLE_START, label: HANDLE_START }]
  }
  return []
}

export function getTargetHandles(type: string): SourceHandle[] {
  const operator = getOperator(type)
  if (operator.kind === 'start' || operator.kind === 'note') {
    return []
  }
  return [{ id: HANDLE_END, label: HANDLE_END }]
}
