import { memo, useState, type JSX, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { resolveNodeModel } from '@/core/models'
import { getOperator, hasOperator } from '@/core/registry'
import type { BaseNodeData } from '@/core/types'
import { useFlowStore } from '@/state/flow-store'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { ModelProviderIcon } from '@/ui/model-icons'
import { CardResizer, cardBoxStyle } from './card-resizer'
import {
  CARD_DEFAULT_WIDTH,
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH
} from './card-metrics'
import { NodeHoverToolbar } from './node-hover-toolbar'
import { NodeIssueBadge } from './node-issue-badge'

export {
  CARD_CHROME_HEADER_PX,
  CARD_DEFAULT_WIDTH,
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  CARD_MODEL_BADGE_PX,
  cardChromeHeaderPx
} from './card-metrics'

export const NodeChrome = memo(function NodeChrome({
  id,
  selected,
  data,
  width,
  height,
  minWidth = CARD_MIN_WIDTH,
  minHeight = CARD_MIN_HEIGHT,
  showDelete = true,
  showCopy = true,
  children
}: {
  id: string
  selected: boolean
  data: BaseNodeData
  /** 节点的显式尺寸（用户拉伸过才有），来自 NodeProps */
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  showDelete?: boolean
  showCopy?: boolean
  children?: ReactNode
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const def = hasOperator(data.label) ? getOperator(data.label) : null
  const Icon = resolveIcon(def?.icon ?? 'Puzzle')
  const color = data.color ?? def?.color ?? '#94a3b8'
  const typeLabel = def?.title ?? data.label
  const badge = useFlowStore(
    useShallow((state) => resolveNodeModel({ id, data }, state.nodes))
  )

  return (
    <div
      className={cn(
        'orchestrator-card relative flex flex-col rounded-lg border border-border bg-elevated shadow-sm',
        selected && 'orchestrator-card-selected'
      )}
      style={{
        ...cardBoxStyle(width, height, CARD_DEFAULT_WIDTH),
        minWidth,
        ...(height == null ? { minHeight } : {})
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardResizer selected={selected} minWidth={minWidth} minHeight={minHeight} />
      <NodeIssueBadge nodeId={id} />
      <NodeHoverToolbar
        nodeId={id}
        visible={hovered || selected}
        showDelete={showDelete}
        showCopy={showCopy}
      />
      <div className="h-1 shrink-0 rounded-t-[7px]" style={{ backgroundColor: color }} />
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm leading-5 font-medium text-primary">{data.name}</div>
          <div className="truncate text-[10px] leading-3 uppercase tracking-wide text-secondary">{typeLabel}</div>
        </div>
      </div>
      {badge ? (
        <div
          data-testid="node-model-badge"
          className="flex h-[22px] shrink-0 items-center gap-1.5 px-3 text-[11px] leading-none text-secondary"
        >
          <ModelProviderIcon provider={badge.provider} className="h-4 w-4" />
          <span className="truncate">
            {badge.name}
            {badge.inherited ? ' · 继承会话' : ''}
          </span>
        </div>
      ) : null}
      {children ? <div className="min-h-0 min-w-0 overflow-hidden">{children}</div> : null}
    </div>
  )
})
