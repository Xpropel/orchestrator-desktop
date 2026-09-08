import { useFlowStore } from '@/state/flow-store'

export function useClipboard(): {
  copySelected: () => void
  pasteClipboard: () => void
  duplicateSelected: () => void
  hasClipboard: boolean
} {
  const copySelected = useFlowStore((state) => state.copySelected)
  const pasteClipboard = useFlowStore((state) => state.pasteClipboard)
  const duplicateSelected = useFlowStore((state) => state.duplicateSelected)
  const hasClipboard = useFlowStore(
    (state) => state.clipboard !== null && state.clipboard.nodes.length > 0
  )

  return { copySelected, pasteClipboard, duplicateSelected, hasClipboard }
}
