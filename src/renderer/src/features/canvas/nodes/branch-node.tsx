import { memo, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { resolveNodeModel } from '@/core/models'
import { getSourceHandles, hasOperator } from '@/core/registry'
import { useFlowStore } from '@/state/flow-store'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { BRANCH_ROW_H, branchOutletTop, outletTopsFromRows } from './branch-outlet'
import { FlowHandle } from './flow-handle'
import { CARD_MIN_HEIGHT, cardChromeHeaderPx } from './card-metrics'
import { NodeChrome } from './node-chrome'

export { BRANCH_ROW_H, branchOutletTop } from './branch-outlet'

export const BranchNode = memo(function BranchNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<CanvasNode>): JSX.Element {
  const outlets = hasOperator(data.label) ? getSourceHandles(data.label, data.form) : []
  const hasModelBadge = useFlowStore(
    useShallow((state) => Boolean(resolveNodeModel({ id, data }, state.nodes)))
  )
  const headerH = cardChromeHeaderPx(hasModelBadge)
  const minHeight = Math.max(CARD_MIN_HEIGHT, headerH + Math.max(outlets.length, 1) * BRANCH_ROW_H)
  const updateNodeInternals = useUpdateNodeInternals()
  const rootRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Array<HTMLLIElement | null>>([])
  const [tops, setTops] = useState<number[]>(() =>
    outlets.map((_, index) => branchOutletTop(index, hasModelBadge))
  )

  useLayoutEffect(() => {
    const next = outletTopsFromRows(rootRef.current, rowRefs.current.slice(0, outlets.length), hasModelBadge)
    setTops((prev) =>
      prev.length === next.length && prev.every((value, index) => Math.abs(value - (next[index] ?? 0)) < 0.25)
        ? prev
        : next
    )
    updateNodeInternals(id)
  }, [id, outlets.length, headerH, width, height, hasModelBadge, updateNodeInternals])

  return (
    <div ref={rootRef} data-testid={`node-branch-${data.label}`} className="relative h-full">
      <FlowHandle type="target" id="end" position={Position.Left} />
      <NodeChrome
        id={id}
        data={data}
        selected={selected}
        width={width}
        height={height}
        minHeight={minHeight}
      >
        <ul className="border-t border-border">
          {outlets.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-secondary">尚未配置出口</li>
          ) : (
            outlets.map((item, index) => (
              <li
                key={item.id}
                ref={(el) => {
                  rowRefs.current[index] = el
                }}
                className="flex h-8 items-center justify-between gap-2 px-3 text-[11px]"
              >
                <span className="min-w-0 truncate font-medium text-primary">{item.label || item.id}</span>
              </li>
            ))
          )}
        </ul>
      </NodeChrome>
      {outlets.map((item, index) => (
        <FlowHandle
          key={item.id}
          type="source"
          id={item.id}
          position={Position.Right}
          isConnectableEnd={false}
          className="nodrag nopan"
          style={{ top: tops[index] ?? branchOutletTop(index, hasModelBadge) }}
        />
      ))}
    </div>
  )
})
