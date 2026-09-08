import { memo, type JSX } from 'react'
import { type NodeProps } from '@xyflow/react'
import { cn } from '@/ui/cn'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { OrderedSourcePorts, orderedPortsMinHeight, useStartOutgoingCount } from './ordered-source-ports'

export const LoopStartNode = memo(function LoopStartNode({
  id,
  selected
}: NodeProps<CanvasNode>): JSX.Element {
  const occupied = useStartOutgoingCount(id)
  return (
    <div
      data-testid="node-loop-start"
      className={cn(
        'relative flex items-center justify-center',
        occupied === 0 ? 'h-5 w-5' : ''
      )}
      style={
        occupied === 0
          ? undefined
          : { minHeight: orderedPortsMinHeight(occupied), minWidth: 28 }
      }
      title="循环起点"
    >
      <div
        className={cn(
          'h-5 w-5 rounded-full border-2 border-accent bg-accent shadow',
          selected && 'orchestrator-card-selected'
        )}
      />
      <OrderedSourcePorts nodeId={id} />
    </div>
  )
})
