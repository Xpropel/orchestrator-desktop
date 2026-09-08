import { memo, type JSX, type ReactNode } from 'react'
import { LayoutTemplate, Maximize2, Redo2, StickyNote, Undo2 } from 'lucide-react'
import { useAddNode } from '@/features/canvas/use-add-node'
import { runAutoLayout } from '@/features/canvas/run-auto-layout'
import { ACTION_LABEL, labeledShortcut } from '@shared/action-labels'
import { cn } from '@/ui/cn'
import { useFlowStore } from '@/state/flow-store'

export const CanvasToolbar = memo(function CanvasToolbar(): JSX.Element {
  const undo = useFlowStore((state) => state.undo)
  const redo = useFlowStore((state) => state.redo)
  const canUndo = useFlowStore((state) => state.historyPast.length > 1)
  const canRedo = useFlowStore((state) => state.historyFuture.length > 0)
  const requestFitView = useFlowStore((state) => state.requestFitView)
  const { addAtViewportCenter } = useAddNode()

  return (
    <div className="absolute left-3 top-toolbar z-10 mt-1 flex items-center gap-0.5 rounded-md border border-border bg-panel/95 p-0.5 shadow-lg backdrop-blur">
      <IconButton title={labeledShortcut('undo')} disabled={!canUndo} onClick={undo}>
        <Undo2 className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton title={labeledShortcut('redo')} disabled={!canRedo} onClick={redo}>
        <Redo2 className="h-3.5 w-3.5" />
      </IconButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <IconButton title={ACTION_LABEL.fitView} onClick={requestFitView}>
        <Maximize2 className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton title={ACTION_LABEL.autoLayout} onClick={runAutoLayout}>
        <LayoutTemplate className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton title={ACTION_LABEL.addNote} onClick={() => addAtViewportCenter('note')}>
        <StickyNote className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
})

function IconButton({
  children,
  title,
  disabled,
  onClick
}: {
  children: ReactNode
  title: string
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded',
        disabled
          ? 'cursor-not-allowed text-secondary opacity-35'
          : 'text-primary hover:bg-elevated'
      )}
    >
      {children}
    </button>
  )
}
