import { nanoid } from 'nanoid'
import { deepClone } from './clone'
import { keyValueItemsToRecord, parseCases, parseCategories, parseKeyValueItems } from './form-items'
import { normalizeStoredEdge } from './graph/connection'
import { stripRuntimeEdge, stripRuntimeNode } from './graph/snapshot'
import { parentIdOf } from './graph/parent-id'
import { HANDLE_ELSE, logicalHandleId } from './handles'
import { migrateLabel, resolveOperatorType } from './migrations'
import { getNodeTypeForKind, getOperator, getSourceHandles, hasOperator } from './registry'
import { isRecord } from './schema'
import type { CaseItem, CategoryItem } from './schema'
import {
  DEFAULT_EDGE_TYPE,
  isFlowDocument,
  isRagflowDocument,
  type FlowDocument,
  type FlowEdge,
  type FlowNode
} from './types'

const RAGFLOW_SWITCH_ELSE = 'end_cpn_ids'

function uniquePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}

function targetsForHandle(edges: FlowEdge[], sourceId: string, handleId: string): string[] {
  return uniquePreserveOrder(
    edges.filter((edge) => edge.source === sourceId && edge.sourceHandle === handleId).map((edge) => edge.target)
  )
}

function applyBranchTargets(params: Record<string, unknown>, nodeId: string, edges: FlowEdge[], type: string): void {
  if (Array.isArray(params.cases)) {
    params.cases = parseCases(params.cases)
  }
  if (Array.isArray(params.categories)) {
    params.categories = parseCategories(params.categories)
  }
  const handles = getSourceHandles(type, params)
  for (const handle of handles) {
    const to = targetsForHandle(edges, nodeId, handle.id)
    if (handle.id === 'else') {
      params.elseTo = to
      continue
    }
    if (handle.id === 'approved' || handle.id === 'rejected') {
      params[`${handle.id}To`] = to
      continue
    }
    if (Array.isArray(params.cases)) {
      params.cases = params.cases.map((item) => {
        if (!isRecord(item) || item.id !== handle.id) return item
        return { ...item, to }
      })
    }
    if (Array.isArray(params.categories)) {
      params.categories = params.categories.map((item) => {
        if (!isRecord(item) || item.id !== handle.id) return item
        return { ...item, to }
      })
    }
  }
}

function formatSwitchItem(item: unknown): string {
  if (!isRecord(item)) {
    return ''
  }
  const left = typeof item.cpn_id === 'string' ? item.cpn_id : typeof item.left === 'string' ? item.left : ''
  const operator = typeof item.operator === 'string' ? item.operator : ''
  const right =
    typeof item.value === 'string' || typeof item.value === 'number'
      ? String(item.value)
      : typeof item.right === 'string'
        ? item.right
        : ''
  return [left, operator, right].filter((part) => part.length > 0).join(' ')
}

function adaptSwitchForm(form: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(form.cases)) {
    return { ...form, cases: parseCases(form.cases) }
  }
  if (!Array.isArray(form.conditions)) {
    return { ...form, cases: parseCases(form.cases) }
  }
  const cases: CaseItem[] = form.conditions.map((condition, index) => {
    const rec = isRecord(condition) ? condition : {}
    const items = Array.isArray(rec.items) ? rec.items : []
    const joiner = rec.logical_operator === 'or' ? ' or ' : ' and '
    const expression = items.map(formatSwitchItem).filter(Boolean).join(joiner)
    const handleId = typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : `Case ${index + 1}`
    return {
      id: handleId,
      label: `Case ${index + 1}`,
      expression
    }
  })
  const next: Record<string, unknown> = { ...form, cases }
  delete next.conditions
  return next
}

function adaptCategorizeForm(form: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(form.categories) && form.categories.length > 0) {
    return { ...form, categories: parseCategories(form.categories) }
  }

  const categories: CategoryItem[] = []

  if (Array.isArray(form.items)) {
    for (const [index, item] of form.items.entries()) {
      if (!isRecord(item)) continue
      const id =
        typeof item.uuid === 'string' && item.uuid.length > 0
          ? item.uuid
          : typeof item.id === 'string' && item.id.length > 0
            ? item.id
            : nanoid(8)
      categories.push({
        id,
        name: typeof item.name === 'string' ? item.name : `Category ${index + 1}`,
        description: typeof item.description === 'string' ? item.description : ''
      })
    }
  } else if (isRecord(form.category_description)) {
    for (const [name, raw] of Object.entries(form.category_description)) {
      const rec = isRecord(raw) ? raw : {}
      const id =
        typeof rec.uuid === 'string' && rec.uuid.length > 0
          ? rec.uuid
          : typeof rec.id === 'string' && rec.id.length > 0
            ? rec.id
            : nanoid(8)
      categories.push({
        id,
        name,
        description: typeof rec.description === 'string' ? rec.description : ''
      })
    }
  }

  const next: Record<string, unknown> = { ...form, categories: parseCategories(categories) }
  delete next.items
  delete next.category_description
  return next
}

function asXY(value: unknown): { x: number; y: number } {
  if (isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number') {
    return { x: value.x, y: value.y }
  }
  return { x: 0, y: 0 }
}

function asNodeData(value: unknown, id: string): FlowNode['data'] {
  if (!isRecord(value)) {
    throw new Error(`Invalid FlowDocument: node "${id}" is missing data`)
  }
  return {
    label: typeof value.label === 'string' ? value.label : '',
    name: typeof value.name === 'string' ? value.name : '',
    description: typeof value.description === 'string' ? value.description : undefined,
    color: typeof value.color === 'string' ? value.color : undefined,
    form: isRecord(value.form) ? { ...value.form } : {}
  }
}

export function toFlowNode(raw: Record<string, unknown>): FlowNode {
  const id = raw.id
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Invalid FlowDocument: node is missing a string id')
  }
  const node: FlowNode = {
    id,
    position: asXY(raw.position),
    data: asNodeData(raw.data, id)
  }
  if (typeof raw.type === 'string') node.type = raw.type
  if (typeof raw.parentId === 'string' && raw.parentId.length > 0) node.parentId = raw.parentId
  if (typeof raw.selected === 'boolean') node.selected = raw.selected
  if (typeof raw.dragging === 'boolean') node.dragging = raw.dragging
  if (typeof raw.width === 'number') node.width = raw.width
  if (typeof raw.height === 'number') node.height = raw.height
  if (typeof raw.deletable === 'boolean') node.deletable = raw.deletable
  if (typeof raw.draggable === 'boolean') node.draggable = raw.draggable
  if (typeof raw.connectable === 'boolean') node.connectable = raw.connectable
  if (isRecord(raw.style)) node.style = deepClone(raw.style)
  if (isRecord(raw.measured) && (typeof raw.measured.width === 'number' || typeof raw.measured.height === 'number')) {
    node.measured = {
      width: typeof raw.measured.width === 'number' ? raw.measured.width : undefined,
      height: typeof raw.measured.height === 'number' ? raw.measured.height : undefined
    }
  }
  return node
}

function toFlowEdge(raw: Record<string, unknown>, index: number): FlowEdge {
  if (typeof raw.source !== 'string' || typeof raw.target !== 'string') {
    throw new Error(`Invalid FlowDocument: graph.edges[${index}] must have string source and target`)
  }
  const edge: FlowEdge = {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `edge-${index}`,
    source: raw.source,
    target: raw.target
  }
  if (typeof raw.sourceHandle === 'string' || raw.sourceHandle === null) {
    edge.sourceHandle = typeof raw.sourceHandle === 'string' ? (logicalHandleId(raw.sourceHandle) ?? raw.sourceHandle) : raw.sourceHandle
  }
  if (typeof raw.targetHandle === 'string' || raw.targetHandle === null) {
    edge.targetHandle = typeof raw.targetHandle === 'string' ? (logicalHandleId(raw.targetHandle) ?? raw.targetHandle) : raw.targetHandle
  }
  if (typeof raw.type === 'string') edge.type = raw.type
  if (typeof raw.selected === 'boolean') edge.selected = raw.selected
  return edge
}

function adaptImportedNode(
  raw: Record<string, unknown>,
  index: number,
  components: FlowDocument['components']
): FlowNode {
  const id = raw.id
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Invalid FlowDocument: graph.nodes[${index}] is missing a string id`)
  }
  const node = toFlowNode(raw)
  const componentName = components[id]?.obj?.component_name
  const originalLabel =
    node.data.label || (typeof componentName === 'string' && componentName.length > 0 ? componentName : '')
  if (!originalLabel) {
    throw new Error(`Invalid FlowDocument: node "${id}" is missing type and a valid data.label`)
  }

  const resolved = resolveOperatorType(originalLabel)
  const wasUnknown = !hasOperator(migrateLabel(originalLabel))
  node.data.label = resolved

  const originalForm = isRecord(node.data.form) ? node.data.form : {}
  if (resolved === 'switch' || originalLabel === 'Switch') {
    node.data.form = adaptSwitchForm(originalForm)
  } else if (resolved === 'classifier' || originalLabel === 'Categorize') {
    node.data.form = adaptCategorizeForm(originalForm)
  } else if (!isRecord(node.data.form)) {
    node.data.form = {}
  }

  if (wasUnknown && resolved === 'custom') {
    const data = raw.data
    node.data.form = isRecord(data) && isRecord(data.form) ? deepClone(data.form) : {}
    node.data.description = `原类型: ${originalLabel}`
  }

  const operator = getOperator(resolved)
  node.type = getNodeTypeForKind(operator.kind)
  if (operator.kind === 'start') {
    node.deletable = true
  }

  if (node.data.name.length === 0) {
    const data = raw.data
    node.data.name = isRecord(data) && typeof data.name === 'string' && data.name.length > 0 ? data.name : resolved
  }

  const fromComponent = components[id]?.parent_id
  const fromNode = parentIdOf(node)
  const parent = fromNode ?? (typeof fromComponent === 'string' ? fromComponent : undefined)
  if (parent) {
    node.parentId = parent
  }
  delete node.extent

  return node
}

function adaptImportedEdge(raw: Record<string, unknown>, index: number): FlowEdge {
  const edge = toFlowEdge(raw, index)
  if (!edge.type) {
    edge.type = DEFAULT_EDGE_TYPE
  }
  if (edge.sourceHandle === RAGFLOW_SWITCH_ELSE) {
    edge.sourceHandle = HANDLE_ELSE
  }
  return edge
}

export function graphToDocument(
  nodes: FlowNode[],
  edges: FlowEdge[],
  title: string,
  globals: Record<string, unknown> = {}
): FlowDocument {
  const cleanNodes = nodes.map(stripRuntimeNode)
  const cleanEdges = edges.map((edge) => stripRuntimeEdge(normalizeStoredEdge(cleanNodes, edge)))
  const components: FlowDocument['components'] = {}

  for (const node of cleanNodes) {
    const type = resolveOperatorType(node.data.label)
    const operator = getOperator(type)
    if (operator.kind === 'note') {
      continue
    }

    const params = deepClone(node.data.form)
    for (const field of operator.params) {
      if (field.type === 'keyValue' && Array.isArray(params[field.key])) {
        params[field.key] = keyValueItemsToRecord(parseKeyValueItems(params[field.key]))
      }
    }
    if (operator.kind === 'branch') {
      applyBranchTargets(params, node.id, cleanEdges, type)
    }

    const parent_id = parentIdOf(node)
    components[node.id] = {
      obj: {
        component_name: type,
        params
      },
      upstream: uniquePreserveOrder(cleanEdges.filter((edge) => edge.target === node.id).map((edge) => edge.source)),
      downstream: uniquePreserveOrder(cleanEdges.filter((edge) => edge.source === node.id).map((edge) => edge.target)),
      ...(parent_id ? { parent_id } : {})
    }
  }

  return {
    version: 1,
    title,
    graph: { nodes: cleanNodes, edges: cleanEdges },
    components,
    globals: deepClone(globals)
  }
}

export function documentToGraph(doc: FlowDocument): {
  nodes: FlowNode[]
  edges: FlowEdge[]
  title: string
} {
  if (!isRecord(doc)) {
    throw new Error('Invalid FlowDocument: expected an object')
  }
  if (doc.version !== 1) {
    throw new Error(`Invalid FlowDocument: version must be 1, got ${String((doc as { version?: unknown }).version)}`)
  }
  if (!doc.graph || typeof doc.graph !== 'object') {
    throw new Error('Invalid FlowDocument: graph is required')
  }
  if (!Array.isArray(doc.graph.nodes)) {
    throw new Error('Invalid FlowDocument: graph.nodes must be an array')
  }
  if (!Array.isArray(doc.graph.edges)) {
    throw new Error('Invalid FlowDocument: graph.edges must be an array')
  }
  if (typeof doc.title !== 'string') {
    throw new Error('Invalid FlowDocument: title must be a string')
  }

  const components = doc.components ?? {}
  const nodes = doc.graph.nodes.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`Invalid FlowDocument: graph.nodes[${index}] must be an object`)
    }
    return adaptImportedNode(raw, index, components)
  })

  const edges = doc.graph.edges.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`Invalid FlowDocument: graph.edges[${index}] must be an object`)
    }
    return adaptImportedEdge(raw, index)
  })

  return { nodes, edges, title: doc.title }
}

export function serializeDocument(doc: FlowDocument): string {
  return JSON.stringify(
    {
      version: doc.version,
      title: doc.title,
      globals: doc.globals ?? {},
      graph: doc.graph,
      components: doc.components
    },
    null,
    2
  )
}

/** 文档内 title：字符串，或 i18n 对象取 zh/en/de。 */
export function pickDocumentTitle(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (!isRecord(value)) {
    return ''
  }
  for (const key of ['zh', 'en', 'de']) {
    const part = value[key]
    if (typeof part === 'string' && part.trim().length > 0) {
      return part.trim()
    }
  }
  for (const part of Object.values(value)) {
    if (typeof part === 'string' && part.trim().length > 0) {
      return part.trim()
    }
  }
  return ''
}

function graphRecordOf(value: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(value.graph) ? value.graph : null
}

function hasGraphNodes(value: Record<string, unknown>): boolean {
  return Array.isArray(graphRecordOf(value)?.nodes)
}

function asFlowDocumentFromRagflow(raw: Record<string, unknown>, fallbackTitle = 'Untitled'): FlowDocument {
  const graph = isRecord(raw.graph) ? raw.graph : {}
  const title = pickDocumentTitle(raw.title) || fallbackTitle
  const globals = isRecord(raw.globals) ? (raw.globals as Record<string, unknown>) : {}
  const components = isRecord(raw.components) ? (raw.components as FlowDocument['components']) : {}
  return {
    version: 1,
    title,
    graph: {
      nodes: Array.isArray(graph.nodes) ? (graph.nodes as FlowNode[]) : [],
      edges: Array.isArray(graph.edges) ? (graph.edges as FlowEdge[]) : []
    },
    components,
    globals
  }
}

export function coerceToFlowDocument(parsed: unknown, fallbackTitle = 'Untitled'): FlowDocument {
  if (!isRecord(parsed)) {
    throw new Error('Invalid FlowDocument: expected an object')
  }

  if (isFlowDocument(parsed)) {
    return {
      version: 1,
      title: parsed.title,
      graph: parsed.graph,
      components: parsed.components ?? {},
      globals: parsed.globals ?? {}
    }
  }

  if (isRecord(parsed.dsl) && hasGraphNodes(parsed.dsl)) {
    const dsl: Record<string, unknown> = { ...parsed.dsl }
    const title = pickDocumentTitle(parsed.title) || pickDocumentTitle(dsl.title) || fallbackTitle
    return asFlowDocumentFromRagflow({ ...dsl, title }, fallbackTitle)
  }

  if (hasGraphNodes(parsed)) {
    return asFlowDocumentFromRagflow(parsed, fallbackTitle)
  }

  if (Array.isArray(parsed.nodes)) {
    return {
      version: 1,
      title: pickDocumentTitle(parsed.title) || fallbackTitle,
      graph: {
        nodes: parsed.nodes as FlowNode[],
        edges: Array.isArray(parsed.edges) ? (parsed.edges as FlowEdge[]) : []
      },
      components: {},
      globals: isRecord(parsed.globals) ? (parsed.globals as Record<string, unknown>) : {}
    }
  }

  if (isRagflowDocument(parsed)) {
    return asFlowDocumentFromRagflow(parsed, fallbackTitle)
  }

  throw new Error('Invalid FlowDocument: expected version 1 with a string title and graph.nodes/edges')
}

export function parseDocument(text: string, options?: { fallbackTitle?: string }): FlowDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid FlowDocument: malformed JSON')
  }
  return coerceToFlowDocument(parsed, options?.fallbackTitle ?? 'Untitled')
}
