import { memo, useState, type JSX } from 'react'
import { NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/ui/cn'
import { CONTAINER_MIN_HEIGHT, CONTAINER_MIN_WIDTH } from '@/core/graph'
import { resolveIcon } from '@/ui/icons'
import { getOperator, hasOperator } from '@/core/registry'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { FlowHandle } from './flow-handle'
import { OrderedSourcePorts, orderedPortsMinHeight, useStartOutgoingCount } from './ordered-source-ports'
import { NodeHoverToolbar } from './node-hover-toolbar'
import { NodeIssueBadge } from './node-issue-badge'

export const ContainerNode = memo(function ContainerNode({
  id,
  data,
  selected
}: NodeProps<CanvasNode>): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const def = hasOperator(data.label) ? getOperator(data.label) : null
  const Icon = resolveIcon(def?.icon ?? 'Repeat')
  const color = data.color ?? def?.color ?? '#f59e0b'
  const occupied = useStartOutgoingCount(id)

  return (
    <div
      data-testid={`node-container-${data.label}`}
      className={cn(
        'orchestrator-card relative h-full min-h-[220px] min-w-[360px] w-full rounded-lg border border-border bg-elevated/80 shadow-sm',
        selected && 'orchestrator-card-selected'
      )}
      style={{ minHeight: Math.max(CONTAINER_MIN_HEIGHT, orderedPortsMinHeight(occupied)) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={CONTAINER_MIN_WIDTH}
        minHeight={CONTAINER_MIN_HEIGHT}
        color="var(--accent)"
      />
      <NodeIssueBadge nodeId={id} />
      <NodeHoverToolbar nodeId={id} visible={hovered || selected} showDelete />
      <FlowHandle type="target" id="end" position={Position.Left} />
      <header className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-primary">{data.name}</div>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-secondary">{def?.title ?? data.label}</span>
      </header>
      <div className="pointer-events-none absolute inset-2 top-12 rounded-md border border-dashed border-border/80" />
      <OrderedSourcePorts nodeId={id} />
    </div>
  )
})
