import { memo, useState, type JSX } from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { getOperator, hasOperator } from '@/core/registry'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { CardResizer, cardBoxStyle } from './card-resizer'
import { FlowHandle } from './flow-handle'
import { NodeHoverToolbar } from './node-hover-toolbar'
import { NodeIssueBadge } from './node-issue-badge'

export const BreakNode = memo(function BreakNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<CanvasNode>): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const def = hasOperator(data.label) ? getOperator(data.label) : null
  const Icon = resolveIcon(def?.icon ?? 'Ban')
  const color = data.color ?? def?.color ?? '#f59e0b'

  return (
    <div
      data-testid="node-break"
      className={cn(
        'orchestrator-card relative flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 py-1.5 shadow-sm',
        selected && 'orchestrator-card-selected'
      )}
      style={cardBoxStyle(width, height)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardResizer selected={selected} minWidth={80} minHeight={28} />
      <NodeIssueBadge nodeId={id} />
      <NodeHoverToolbar nodeId={id} visible={hovered || selected} showDelete />
      <FlowHandle type="target" id="end" position={Position.Left} />
      <span
        className="flex h-5 w-5 items-center justify-center rounded"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon className="h-3 w-3" />
      </span>
      <span className="text-xs font-medium text-primary">{data.name}</span>
    </div>
  )
})
