import { memo, type JSX, type ReactNode } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import { Copy, Trash2 } from 'lucide-react'
import { ACTION_LABEL } from '@shared/action-labels'
import { cn } from '@/ui/cn'
import { useFlowStore } from '@/state/flow-store'

export const NodeHoverToolbar = memo(function NodeHoverToolbar({
  nodeId,
  visible,
  showDelete,
  showCopy = true
}: {
  nodeId: string
  visible: boolean
  showDelete: boolean
  showCopy?: boolean
}): JSX.Element {
  return (
    <NodeToolbar
      nodeId={nodeId}
      isVisible={visible}
      position={Position.Top}
      offset={8}
      className="flex items-center gap-0.5 rounded-md border border-border bg-panel px-1 py-0.5 shadow-lg"
    >
      {showCopy ? (
        <ToolbarIconButton
          title={ACTION_LABEL.copy}
          onClick={() => {
            useFlowStore.getState().selectNode(nodeId)
            useFlowStore.getState().copySelected()
          }}
        >
          <Copy className="h-3 w-3" />
        </ToolbarIconButton>
      ) : null}
      {showDelete ? (
        <ToolbarIconButton
          title={ACTION_LABEL.delete}
          onClick={() => {
            useFlowStore.getState().removeNode(nodeId)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </ToolbarIconButton>
      ) : null}
    </NodeToolbar>
  )
})

function ToolbarIconButton({
  children,
  title,
  onClick
}: {
  children: ReactNode
  title: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'nodrag nopan inline-flex h-6 w-6 items-center justify-center rounded text-secondary',
        'hover:bg-elevated hover:text-primary'
      )}
    >
      {children}
    </button>
  )
}
