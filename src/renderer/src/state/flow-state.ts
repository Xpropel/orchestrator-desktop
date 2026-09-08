import type {
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Viewport,
  XYPosition
} from '@xyflow/react'
import type { ClipboardGraph, GraphSnapshot } from '@/core/graph'
import type { BaseNodeData, FlowDocument, FlowEdge, FlowNode } from '@/core/types'

export type RfNode = import('@xyflow/react').Node<BaseNodeData & Record<string, unknown>>

export interface HistorySlice {
  historyPast: GraphSnapshot[]
  historyFuture: GraphSnapshot[]
  recordHistory: () => void
  undo: () => void
  redo: () => void
}

export interface ClipboardSlice {
  clipboard: ClipboardGraph | null
  copySelected: () => void
  pasteClipboard: () => void
  duplicateSelected: () => void
}

export interface ContainerSlice {
  setNodeParent: (nodeId: string, parentId: string | null, relativePosition: XYPosition) => void
  removeNode: (id: string) => void
}

export interface DirtySlice {
  dirty: boolean
  savedSnapshotKey: string
  markSaved: (filePath: string) => void
  markUnsaved: () => void
  loadDocument: (doc: FlowDocument, filePath: string | null) => void
  resetToEmpty: () => void
}

export interface FlowState extends HistorySlice, ClipboardSlice, ContainerSlice, DirtySlice {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedNodeId: string | null
  filePath: string | null
  title: string
  globals: Record<string, unknown>
  revision: number
  viewportRequest: number
  viewport: Viewport
  onNodesChange: OnNodesChange<RfNode>
  onEdgesChange: OnEdgesChange<FlowEdge>
  onConnect: OnConnect
  addNode: (node: FlowNode) => void
  updateNodeData: (id: string, patch: Partial<BaseNodeData>) => void
  updateNodeForm: (id: string, patch: Record<string, unknown>) => void
  replaceNodeForm: (id: string, next: Record<string, unknown>) => void
  setGlobals: (patch: Record<string, unknown>) => void
  selectNode: (id: string | null, options?: { exclusive?: boolean }) => void
  setTitle: (title: string) => void
  setViewport: (viewport: Viewport) => void
  applyNodePositions: (
    positions: Record<string, { x: number; y: number }>,
    sizes?: Record<string, { width: number; height: number }>
  ) => void
  requestFitView: () => void
  removeEdge: (id: string) => void
  moveOutgoingEdge: (edgeId: string, toIndex: number) => void
}
