import { snapshotKeyOf } from '@/core/graph'
import type { FlowSlice } from './flow-slice'
import { emptyCanvas, keyOf, snapshotOf, titleFromPath } from './flow-helpers'
import { flushFormHistory } from './history-slice'
import type { DirtySlice } from './flow-state'

export const createDirtySlice: FlowSlice<DirtySlice> = (set) => ({
  dirty: false,
  savedSnapshotKey: '',
  markSaved: (filePath, written) => {
    set((state) => {
      state.filePath = filePath
      const pathTitle = titleFromPath(filePath)
      if (state.title === 'Untitled') {
        state.title = pathTitle
        const last = state.historyPast[state.historyPast.length - 1]
        if (last) last.title = state.title
      }
      const source = written ?? state
      const savedTitle = source.title === 'Untitled' ? pathTitle : source.title
      state.savedSnapshotKey = keyOf(source.nodes, source.edges, savedTitle, source.globals ?? {})
      state.dirty =
        keyOf(state.nodes, state.edges, state.title, state.globals) !== state.savedSnapshotKey
    })
  },
  // 当前内容没有已保存的对应物：哨兵 key 不会与真实 snapshotKey 相等，后续 syncDirtyFromSnapshot 保持 dirty。
  markUnsaved: () => {
    set((state) => {
      state.dirty = true
      state.savedSnapshotKey = ''
    })
  },
  loadDocument: (doc, filePath) => {
    flushFormHistory()
    set((state) => {
      state.nodes = doc.graph.nodes
      state.edges = doc.graph.edges
      state.title = doc.title
      state.filePath = filePath
      state.globals = { ...(doc.globals ?? {}) }
      state.selectedNodeId = null
      state.dirty = false
      const snap = snapshotOf(doc.graph.nodes, doc.graph.edges, doc.title, state.globals)
      state.historyPast = [snap]
      state.historyFuture = []
      state.savedSnapshotKey = snapshotKeyOf(snap)
      state.revision += 1
      state.viewportRequest += 1
    })
  },
  resetToEmpty: () => {
    flushFormHistory()
    set((state) => {
      const next = emptyCanvas()
      state.nodes = next.nodes
      state.edges = next.edges
      state.selectedNodeId = next.selectedNodeId
      state.filePath = next.filePath
      state.title = next.title
      state.dirty = next.dirty
      state.globals = next.globals
      const snap = snapshotOf(next.nodes, next.edges, next.title, next.globals)
      state.historyPast = [snap]
      state.historyFuture = []
      state.savedSnapshotKey = snapshotKeyOf(snap)
      state.revision += 1
      state.viewportRequest += 1
    })
  }
})
