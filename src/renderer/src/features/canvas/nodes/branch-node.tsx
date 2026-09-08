import { memo, type JSX } from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { getSourceHandles, hasOperator } from '@/core/registry'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { FlowHandle } from './flow-handle'
import { NodeChrome } from './node-chrome'

const HEADER_H = 52
const ROW_H = 32

export const BranchNode = memo(function BranchNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<CanvasNode>): JSX.Element {
  const outlets = hasOperator(data.label) ? getSourceHandles(data.label, data.form) : []

  return (
    <div data-testid={`node-branch-${data.label}`} className="relative h-full">
      <FlowHandle type="target" id="end" position={Position.Left} />
      <NodeChrome id={id} data={data} selected={selected} width={width} height={height}>
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
          style={{ top: HEADER_H + index * ROW_H + ROW_H / 2 }}
        />
      ))}
    </div>
  )
})
