import {
  collectDescendantIds,
  createLoopStartNode,
  idsProtectedFromRemoval,
  isContainerNode,
  isProtectedNode,
  isStartNode
} from '@/core/graph'
import type { FlowEdge, FlowNode } from '@/core/types'
import type { FlowSlice } from './flow-slice'
import { dropIds, pushSnapshot, replaceTopSnapshot, syncDirtyFromSnapshot, unwrap } from './flow-helpers'
import { flushFormHistory } from './history-slice'
import type { ContainerSlice } from './flow-state'

/** 容器内外互连合法；拖入 / 拖出时不再拆掉跨边界的边。 */
export function dropCrossContainerEdges(_state: { nodes: FlowNode[]; edges: FlowEdge[] }): void {
  return
}

export function ensureLoopStart(state: { nodes: FlowNode[] }, node: FlowNode): void {
  if (!isContainerNode(node)) return
  const startId = `${node.id}:start`
  if (!state.nodes.some((item) => item.id === startId)) {
    state.nodes.push(createLoopStartNode(node.id, unwrap(state.nodes)))
  }
}

export const createContainerSlice: FlowSlice<ContainerSlice> = (set, get) => ({
  setNodeParent: (nodeId, parentId, relativePosition) => {
    flushFormHistory()
    set((state) => {
      const node = state.nodes.find((item) => item.id === nodeId)
      if (!node || isStartNode(node) || isProtectedNode(node, state.nodes) || isContainerNode(node)) return
      if (parentId) {
        const parent = state.nodes.find((item) => item.id === parentId)
        if (!parent || !isContainerNode(parent)) return
        node.parentId = parentId
      } else {
        delete node.parentId
      }
      node.position = { ...relativePosition }
      dropCrossContainerEdges(state)
      replaceTopSnapshot(state)
      syncDirtyFromSnapshot(state)
    })
  },
  removeNode: (id) => {
    const currentNodes = get().nodes
    const node = currentNodes.find((item) => item.id === id)
    if (!node || isProtectedNode(node, currentNodes)) return
    flushFormHistory()
    set((state) => {
      const removeIds = new Set([id, ...collectDescendantIds(state.nodes, id)])
      dropIds(state, removeIds)
      pushSnapshot(state)
      syncDirtyFromSnapshot(state)
    })
  },
  removeSelected: () => {
    flushFormHistory()
    set((state) => {
      const selectedIds = state.nodes.filter((node) => node.selected).map((node) => node.id)
      if (state.selectedNodeId && !selectedIds.includes(state.selectedNodeId)) {
        selectedIds.push(state.selectedNodeId)
      }
      const protectedIds = idsProtectedFromRemoval(state.nodes, selectedIds)
      const removeIds = new Set(selectedIds.filter((id) => !protectedIds.has(id)))
      for (const id of [...removeIds]) {
        for (const childId of collectDescendantIds(state.nodes, id)) {
          removeIds.add(childId)
        }
      }
      const selectedEdgeIds = new Set(state.edges.filter((edge) => edge.selected).map((edge) => edge.id))
      const nodeCount = state.nodes.length
      const edgeCount = state.edges.length
      dropIds(state, removeIds)
      if (selectedEdgeIds.size > 0) {
        state.edges = state.edges.filter((edge) => !selectedEdgeIds.has(edge.id))
      }
      if (state.nodes.length === nodeCount && state.edges.length === edgeCount) return
      pushSnapshot(state)
      syncDirtyFromSnapshot(state)
    })
  }
})
