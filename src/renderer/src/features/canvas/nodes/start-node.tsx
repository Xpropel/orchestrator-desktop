import { memo, useState, type JSX } from 'react'
import { type NodeProps } from '@xyflow/react'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { isProtectedNode } from '@/core/graph'
import { getOperator, hasOperator } from '@/core/registry'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { useFlowStore } from '@/state/flow-store'
import { CardResizer, PILL_MIN_HEIGHT, PILL_MIN_WIDTH, cardBoxStyle } from './card-resizer'
import { OrderedSourcePorts, orderedPortsMinHeight, useStartOutgoingCount } from './ordered-source-ports'
import { NodeHoverToolbar } from './node-hover-toolbar'
import { NodeIssueBadge } from './node-issue-badge'

export const StartNode = memo(function StartNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<CanvasNode>): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const canDelete = useFlowStore((state) => {
    const self = state.nodes.find((item) => item.id === id)
    return self ? !isProtectedNode(self, state.nodes) : false
  })
  const def = hasOperator(data.label) ? getOperator(data.label) : null
  const Icon = resolveIcon(def?.icon ?? 'Play')
  const color = data.color ?? def?.color ?? '#10b981'
  const occupied = useStartOutgoingCount(id)

  return (
    <div
      data-testid="node-start"
      className={cn(
        'orchestrator-card relative flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 shadow-sm',
        selected && 'orchestrator-card-selected'
      )}
      style={{ ...cardBoxStyle(width, height), minHeight: orderedPortsMinHeight(occupied) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardResizer selected={selected} minWidth={PILL_MIN_WIDTH} minHeight={PILL_MIN_HEIGHT} />
      <NodeIssueBadge nodeId={id} />
      <NodeHoverToolbar nodeId={id} visible={hovered || selected} showDelete={canDelete} showCopy={false} />
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-medium text-primary">{data.name}</span>
      <OrderedSourcePorts nodeId={id} />
    </div>
  )
})
