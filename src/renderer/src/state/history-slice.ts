import { cloneGraph } from '@/core/graph'
import type { FlowSlice } from './flow-slice'
import {
  pushSnapshot,
  snapshotOf,
  syncDirtyFromSnapshot
} from './flow-helpers'
import type { HistorySlice } from './flow-state'

const FORM_HISTORY_MS = 400

let formHistoryTimer: ReturnType<typeof setTimeout> | undefined
let recordHistoryFn: (() => void) | null = null

export function bindHistoryRecorder(fn: () => void): void {
  recordHistoryFn = fn
}

export function scheduleFormHistory(): void {
  if (formHistoryTimer !== undefined) {
    clearTimeout(formHistoryTimer)
  }
  formHistoryTimer = setTimeout(() => {
    formHistoryTimer = undefined
    recordHistoryFn?.()
  }, FORM_HISTORY_MS)
}

export function flushFormHistory(): void {
  if (formHistoryTimer === undefined) return
  clearTimeout(formHistoryTimer)
  formHistoryTimer = undefined
  recordHistoryFn?.()
}

export const createHistorySlice: FlowSlice<HistorySlice> = (set, get) => ({
  historyPast: [],
  historyFuture: [],
  recordHistory: () => {
    set((state) => {
      pushSnapshot(state)
    })
  },
  undo: () => {
    flushFormHistory()
    const { historyPast, nodes, edges, title, globals, selectedNodeId } = get()
    if (historyPast.length <= 1) return
    const currentSnap = snapshotOf(nodes, edges, title, globals)
    currentSnap.selectedNodeId = selectedNodeId
    const prev = historyPast[historyPast.length - 2]
    if (!prev) return
    set((state) => {
      state.historyPast.pop()
      state.historyFuture.push(currentSnap)
      const restored = cloneGraph(prev.nodes, prev.edges, prev.title, prev.globals ?? {})
      state.nodes = restored.nodes
      state.edges = restored.edges
      state.title = restored.title
      state.globals = restored.globals
      state.selectedNodeId = prev.selectedNodeId ?? null
      state.nodes.forEach((item) => {
        item.selected = item.id === state.selectedNodeId
      })
      syncDirtyFromSnapshot(state)
      state.revision += 1
    })
  },
  redo: () => {
    flushFormHistory()
    const { historyFuture } = get()
    const next = historyFuture[historyFuture.length - 1]
    if (!next) return
    set((state) => {
      if (state.historyFuture.length === 0) return
      state.historyFuture.pop()
      const restored = cloneGraph(next.nodes, next.edges, next.title, next.globals ?? {})
      state.nodes = restored.nodes
      state.edges = restored.edges
      state.title = restored.title
      state.globals = restored.globals
      const restoredSnap = snapshotOf(state.nodes, state.edges, state.title, state.globals)
      restoredSnap.selectedNodeId = next.selectedNodeId ?? null
      state.historyPast.push(restoredSnap)
      state.selectedNodeId = next.selectedNodeId ?? null
      state.nodes.forEach((item) => {
        item.selected = item.id === state.selectedNodeId
      })
      syncDirtyFromSnapshot(state)
      state.revision += 1
    })
  }
})
