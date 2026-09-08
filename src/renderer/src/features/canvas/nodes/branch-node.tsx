import { memo, useLayoutEffect, type JSX } from 'react'
import { Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { resolveNodeModel } from '@/core/models'
import { getSourceHandles, hasOperator } from '@/core/registry'
import { useFlowStore } from '@/state/flow-store'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { FlowHandle } from './flow-handle'
import { CARD_MIN_HEIGHT, NodeChrome, cardChromeHeaderPx } from './node-chrome'

export const BRANCH_ROW_H = 32

export function branchOutletTop(index: number, hasModelBadge: boolean): number {
  return cardChromeHeaderPx(hasModelBadge) + index * BRANCH_ROW_H + BRANCH_ROW_H / 2
}

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

  useLayoutEffect(() => {
    updateNodeInternals(id)
  }, [id, outlets.length, headerH, width, height, updateNodeInternals])

  return (
    <div data-testid={`node-branch-${data.label}`} className="relative h-full">
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
            outlets.map((item) => (
              <li key={item.id} className="flex h-8 items-center justify-between gap-2 px-3 text-[11px]">
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
          style={{ top: branchOutletTop(index, hasModelBadge) }}
        />
      ))}
    </div>
  )
})
