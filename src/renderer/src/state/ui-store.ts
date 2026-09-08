import { create } from 'zustand'

let toastTimer: ReturnType<typeof setTimeout> | undefined

interface UiState {
  issuesPanelOpen: boolean
  toggleIssuesPanel: () => void
  openCategory: string | null
  setOpenCategory: (key: string | null) => void
  /**
   * 属性面板正在查看的节点。与画布选中态（`flow-store.selectedNodeId`）刻意分离：
   * 拖动、框选、右键都会改变选中，但只有明确点击节点才打开面板。 */
  inspectorNodeId: string | null
  openInspector: (nodeId: string) => void
  closeInspector: () => void
  toast: string | null
  showToast: (message: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  issuesPanelOpen: false,
  toggleIssuesPanel: () => set((state) => ({ issuesPanelOpen: !state.issuesPanelOpen })),
  openCategory: null,
  setOpenCategory: (key) => set({ openCategory: key }),
  inspectorNodeId: null,
  openInspector: (nodeId) => set({ inspectorNodeId: nodeId }),
  closeInspector: () => set({ inspectorNodeId: null }),
  toast: null,
  showToast: (message) => {
    if (toastTimer !== undefined) {
      clearTimeout(toastTimer)
    }
    set({ toast: message })
    toastTimer = setTimeout(() => {
      toastTimer = undefined
      set({ toast: null })
    }, 2600)
  }
}))
