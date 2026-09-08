import { extractSubgraph } from '@/core/graph'
import type { FlowSlice } from './flow-slice'
import { applyClipboard } from './flow-helpers'
import { flushFormHistory } from './history-slice'
import type { ClipboardSlice } from './flow-state'

export const createClipboardSlice: FlowSlice<ClipboardSlice> = (set, get) => ({
  clipboard: null,
  copySelected: () => {
    const { nodes, edges } = get()
    const ids = nodes.filter((node) => node.selected).map((node) => node.id)
    const payload = extractSubgraph(nodes, edges, ids)
    if (payload.nodes.length === 0) return
    set((state) => {
      state.clipboard = payload
    })
  },
  pasteClipboard: () => {
    const { clipboard } = get()
    if (!clipboard || clipboard.nodes.length === 0) return
    flushFormHistory()
    set((state) => {
      applyClipboard(state, clipboard)
      if (state.clipboard) {
        state.clipboard = {
          nodes: state.clipboard.nodes.map((node) => ({
            ...node,
            position: {
              x: node.position.x + (node.parentId ? 0 : 40),
              y: node.position.y + (node.parentId ? 0 : 40)
            }
          })),
          edges: state.clipboard.edges
        }
      }
    })
  },
  duplicateSelected: () => {
    const { nodes, edges } = get()
    const ids = nodes.filter((node) => node.selected).map((node) => node.id)
    const payload = extractSubgraph(nodes, edges, ids)
    if (payload.nodes.length === 0) return
    flushFormHistory()
    set((state) => {
      applyClipboard(state, payload)
    })
  }
})
