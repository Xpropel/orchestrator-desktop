import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange
} from '@xyflow/react'
import { setAutoFreeze } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  collectDescendantIds,
  idsProtectedFromRemoval,
  isValidFlowConnection,
  normalizeFlowConnection,
  normalizeStoredEdge,
  reorderOutgoingEdges,
  snapshotKeyOf
} from '@/core/graph'
import type { FlowEdge, FlowNode } from '@/core/types'
import { createClipboardSlice } from './clipboard-slice'
import { createContainerSlice, ensureLoopStart } from './container-slice'
import { createDirtySlice } from './dirty-slice'
import {
  applyRename,
  dropIds,
  emptyCanvas,
  isDirtyNodeChange,
  pruneDraft,
  pushSnapshot,
  snapshotOf,
  syncDirtyFromSnapshot
} from './flow-helpers'
import type { FlowState, RfNode } from './flow-state'
import { bindHistoryRecorder, createHistorySlice, flushFormHistory, scheduleFormHistory } from './history-slice'

export type { FlowState } from './flow-state'

// React Flow mutates node objects during drag; immer auto-freeze would throw.
setAutoFreeze(false)

const initialCanvas = emptyCanvas()
const initialSnapshot = snapshotOf(
  initialCanvas.nodes,
  initialCanvas.edges,
  initialCanvas.title,
  initialCanvas.globals
)

export const useFlowStore = create<FlowState>()(
  immer((...args) => {
    const [set, get] = args
    return {
      ...createHistorySlice(...args),
      ...createClipboardSlice(...args),
      ...createContainerSlice(...args),
      ...createDirtySlice(...args),
      ...initialCanvas,
      revision: 0,
      viewportRequest: 0,
      viewport: { x: 0, y: 0, zoom: 1 },
      historyPast: [initialSnapshot],
      historyFuture: [],
      savedSnapshotKey: snapshotKeyOf(initialSnapshot),
      clipboard: null,

      onNodesChange: (changes) => {
        set((state) => {
          const removingIds = changes.filter((change) => change.type === 'remove').map((change) => change.id)
          const protectedIds = idsProtectedFromRemoval(state.nodes, removingIds)
          const nextChanges = changes.filter(
            (change) => change.type !== 'remove' || !protectedIds.has(change.id)
          )
          const shouldRecord =
            nextChanges.some((change) => change.type === 'remove' || change.type === 'add') ||
            nextChanges.some((change) => change.type === 'dimensions' && change.resizing === false) ||
            nextChanges.some((change) => change.type === 'position' && change.dragging === false) ||
            nextChanges.some((change) => change.type === 'replace' && isDirtyNodeChange(change, state.nodes))
          state.nodes = applyNodeChanges(nextChanges, state.nodes as RfNode[]) as FlowNode[]
          if (nextChanges.some((change) => change.type === 'select')) {
            state.selectedNodeId = state.nodes.find((node) => node.selected)?.id ?? null
          }
          const removedIds = new Set(
            nextChanges.filter((change) => change.type === 'remove').map((change) => change.id)
          )
          if (removedIds.size > 0) {
            const extra = new Set<string>()
            for (const id of removedIds) {
              for (const childId of collectDescendantIds(state.nodes, id)) {
                extra.add(childId)
              }
            }
            const liveIds = new Set(state.nodes.map((node) => node.id))
            for (const node of state.nodes) {
              if (node.parentId && !liveIds.has(node.parentId)) {
                extra.add(node.id)
              }
            }
            dropIds(state, extra)
          }
          if (state.selectedNodeId && removedIds.has(state.selectedNodeId)) {
            state.selectedNodeId = null
          }
          if (shouldRecord) {
            pushSnapshot(state)
          }
          syncDirtyFromSnapshot(state)
        })
      },

      onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => {
        set((state) => {
          state.edges = applyEdgeChanges(changes, state.edges).map((edge) =>
            normalizeStoredEdge(state.nodes, edge)
          )
          if (changes.some((change) => change.type === 'remove' || change.type === 'add')) {
            pushSnapshot(state)
          }
          syncDirtyFromSnapshot(state)
        })
      },

      onConnect: (connection: Connection) => {
        const { nodes, edges } = get()
        const normalized = normalizeFlowConnection(nodes, connection)
        if (!normalized.source || !normalized.target) return
        if (!isValidFlowConnection(nodes, edges, normalized)) return
        const stored: Connection = {
          source: normalized.source,
          target: normalized.target,
          sourceHandle: normalized.sourceHandle ?? null,
          targetHandle: normalized.targetHandle ?? null
        }
        set((state) => {
          state.edges = addEdge({ ...stored, type: 'buttonEdge' }, state.edges)
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
        })
      },

      addNode: (node) => {
        flushFormHistory()
        set((state) => {
          state.nodes.push(node)
          ensureLoopStart(state, node)
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
        })
      },

      updateNodeData: (id, patch) => {
        set((state) => {
          const node = state.nodes.find((item) => item.id === id)
          if (!node) return
          const oldName = node.data.name
          Object.assign(node.data, patch)
          if (typeof patch.name === 'string' && patch.name !== oldName) {
            applyRename(state, oldName, patch.name)
          }
          syncDirtyFromSnapshot(state)
        })
        scheduleFormHistory()
      },

      updateNodeForm: (id, patch) => {
        set((state) => {
          const node = state.nodes.find((item) => item.id === id)
          if (!node) return
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) {
              delete node.data.form[key]
            } else {
              node.data.form[key] = value
            }
          }
          pruneDraft(state)
          syncDirtyFromSnapshot(state)
        })
        scheduleFormHistory()
      },

      replaceNodeForm: (id, next) => {
        set((state) => {
          const node = state.nodes.find((item) => item.id === id)
          if (!node) return
          node.data.form = { ...next }
          pruneDraft(state)
          syncDirtyFromSnapshot(state)
        })
        scheduleFormHistory()
      },

      setGlobals: (patch) => {
        flushFormHistory()
        set((state) => {
          const next = { ...state.globals }
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) {
              delete next[key]
            } else {
              next[key] = value
            }
          }
          state.globals = next
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
        })
      },

      selectNode: (id, options) => {
        const exclusive = options?.exclusive ?? true
        set((state) => {
          state.selectedNodeId = id
          if (exclusive) {
            state.nodes.forEach((node) => {
              node.selected = node.id === id
            })
          } else if (id) {
            const node = state.nodes.find((item) => item.id === id)
            if (node) node.selected = true
          }
        })
      },

      setTitle: (title) => {
        set((state) => {
          state.title = title
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
        })
      },

      setViewport: (viewport) => {
        set((state) => {
          state.viewport = viewport
        })
      },

      applyNodePositions: (positions, sizes) => {
        flushFormHistory()
        set((state) => {
          for (const node of state.nodes) {
            const next = positions[node.id]
            if (next) {
              node.position = { ...next }
            }
            const size = sizes?.[node.id]
            if (size) {
              node.width = size.width
              node.height = size.height
              node.style = { ...(node.style ?? {}), width: size.width, height: size.height }
            }
          }
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
          state.viewportRequest += 1
        })
      },

      requestFitView: () => {
        set((state) => {
          state.viewportRequest += 1
        })
      },

      removeEdge: (id) => {
        flushFormHistory()
        set((state) => {
          const next = state.edges.filter((edge) => edge.id !== id)
          if (next.length === state.edges.length) return
          state.edges = next
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
        })
      },

      moveOutgoingEdge: (edgeId, toIndex) => {
        flushFormHistory()
        set((state) => {
          const next = reorderOutgoingEdges(state.edges, edgeId, toIndex)
          if (next === state.edges) return
          state.edges = next
          pushSnapshot(state)
          syncDirtyFromSnapshot(state)
        })
      }
    }
  })
)

bindHistoryRecorder(() => useFlowStore.getState().recordHistory())
