import { extractSubgraph, resolvePasteParentId } from '@/core/graph'
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
    const { clipboard, nodes } = get()
    if (!clipboard || clipboard.nodes.length === 0) return
    const selectedIds = nodes.filter((node) => node.selected).map((node) => node.id)
    const targetParentId = resolvePasteParentId(clipboard, nodes, selectedIds)
    flushFormHistory()
    set((state) => {
      applyClipboard(state, clipboard, targetParentId === undefined ? undefined : { targetParentId })
      if (state.clipboard) {
        state.clipboard = {
          nodes: state.clipboard.nodes.map((node) => {
            // 容器内重复粘贴原先偏移 0 会叠在一起；画布顶层仍用 40 的绝对步进。
            const stack = node.parentId ? 16 : 40
            return {
              ...node,
              position: {
                x: node.position.x + stack,
                y: node.position.y + stack
              }
            }
          }),
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
