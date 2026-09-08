import { memo, useState, type JSX } from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { getOperator, hasOperator } from '@/core/registry'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { CardResizer, PILL_MIN_HEIGHT, PILL_MIN_WIDTH, cardBoxStyle } from './card-resizer'
import { FlowHandle } from './flow-handle'
import { NodeHoverToolbar } from './node-hover-toolbar'
import { NodeIssueBadge } from './node-issue-badge'

export const EndNode = memo(function EndNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<CanvasNode>): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const def = hasOperator(data.label) ? getOperator(data.label) : null
  const Icon = resolveIcon(def?.icon ?? 'CircleStop')
  const color = data.color ?? def?.color ?? '#10b981'

  return (
    <div
      data-testid="node-end"
      className={cn(
        'orchestrator-card relative flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 shadow-sm',
        selected && 'orchestrator-card-selected'
      )}
      style={cardBoxStyle(width, height)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardResizer selected={selected} minWidth={PILL_MIN_WIDTH} minHeight={PILL_MIN_HEIGHT} />
      <NodeIssueBadge nodeId={id} />
      <NodeHoverToolbar nodeId={id} visible={hovered || selected} showDelete />
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-medium text-primary">{data.name}</span>
      <FlowHandle type="target" id="end" position={Position.Left} />
    </div>
  )
})
