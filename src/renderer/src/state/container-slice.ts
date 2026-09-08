import {
  collectDescendantIds,
  createLoopStartNode,
  isContainerNode,
  isProtectedNode,
  isStartNode
} from '@/core/graph'
import type { FlowNode } from '@/core/types'
import type { FlowSlice } from './flow-slice'
import { dropIds, pushSnapshot, replaceTopSnapshot, syncDirtyFromSnapshot, unwrap } from './flow-helpers'
import { flushFormHistory } from './history-slice'
import type { ContainerSlice } from './flow-state'

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
  }
})
