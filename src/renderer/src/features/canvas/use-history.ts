import { useFlowStore } from '@/state/flow-store'

export function useHistory(): {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  recordHistory: () => void
} {
  const undo = useFlowStore((state) => state.undo)
  const redo = useFlowStore((state) => state.redo)
  const recordHistory = useFlowStore((state) => state.recordHistory)
  const canUndo = useFlowStore((state) => state.historyPast.length > 1)
  const canRedo = useFlowStore((state) => state.historyFuture.length > 0)

  return { undo, redo, canUndo, canRedo, recordHistory }
}
