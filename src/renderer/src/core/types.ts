export interface XYPosition {
  x: number
  y: number
}

export interface BaseNodeData {
  label: string
  name: string
  description?: string
  color?: string
  form: Record<string, unknown>
}

export interface FlowNode {
  id: string
  type?: FlowNodeType | string
  position: XYPosition
  data: BaseNodeData
  parentId?: string
  selected?: boolean
  dragging?: boolean
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
  style?: object
  deletable?: boolean
  draggable?: boolean
  connectable?: boolean
  extent?: 'parent' | null
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  selected?: boolean
}

export interface FlowConnection {
  source: string | null
  target: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
}

interface FlowComponent {
  obj: { component_name: string; params: Record<string, unknown> }
  upstream: string[]
  downstream: string[]
  parent_id?: string
}

/** 与 RAGFlow DSL 同构的落盘格式 */
export interface FlowDocument {
  version: 1
  title: string
  graph: { nodes: FlowNode[]; edges: FlowEdge[] }
  components: Record<string, FlowComponent>
  globals: Record<string, unknown>
}

export function isFlowDocument(value: unknown): value is FlowDocument {
  if (!value || typeof value !== 'object') {
    return false
  }

  const doc = value as Partial<FlowDocument>
  return (
    doc.version === 1 &&
    typeof doc.title === 'string' &&
    !!doc.graph &&
    Array.isArray(doc.graph.nodes) &&
    Array.isArray(doc.graph.edges)
  )
}

export function isRagflowDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }
  const doc = value as Record<string, unknown>
  if (doc.version !== undefined) {
    return false
  }
  const graph = doc.graph
  return (
    !!graph &&
    typeof graph === 'object' &&
    Array.isArray((graph as { nodes?: unknown }).nodes) &&
    !!doc.components &&
    typeof doc.components === 'object'
  )
}

export type FlowNodeType =
  | 'startNode'
  | 'endNode'
  | 'taskNode'
  | 'branchNode'
  | 'containerNode'
  | 'loopStartNode'
  | 'breakNode'
  | 'noteNode'

export const DEFAULT_EDGE_TYPE = 'buttonEdge'
