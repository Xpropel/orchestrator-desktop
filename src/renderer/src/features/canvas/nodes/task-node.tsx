import { memo, type JSX } from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { getNodeSummary } from '@/core/graph'
import { getNodeOutputs } from '@/core/variables'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { FlowHandle } from './flow-handle'
import { NodeChrome } from './node-chrome'
import { OrderedSourcePorts, orderedPortsMinHeight, useStartOutgoingCount } from './ordered-source-ports'

export const TaskNode = memo(function TaskNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<CanvasNode>): JSX.Element {
  const summary = getNodeSummary(data)
  // 输出变量（供下游 {{名称.变量}} 引用），含 outputsFromParam 派生的字段；与出边数量无关。
  const outputNames = getNodeOutputs({ data }).map((item) => item.name)
  const occupied = useStartOutgoingCount(id)

  return (
    <div
      data-testid={`node-task-${data.label}`}
      className="relative h-full"
      style={{ minHeight: orderedPortsMinHeight(occupied) }}
    >
      <FlowHandle type="target" id="end" position={Position.Left} />
      <NodeChrome id={id} data={data} selected={selected} width={width} height={height}>
        {summary ? (
          <div className="border-t border-border px-3 py-1.5 text-[11px] text-secondary">
            <span className="line-clamp-2">{summary}</span>
          </div>
        ) : null}
        {outputNames.length > 0 ? (
          <div
            data-testid="node-outputs"
            className="flex gap-1.5 border-t border-border px-3 py-1 text-[10px] text-secondary"
            title={`输出变量：${outputNames.join(', ')}（下游以 {{${data.name}.变量}} 引用）`}
          >
            <span className="shrink-0 opacity-70">输出变量</span>
            <span className="min-w-0 truncate font-mono">{outputNames.join(' · ')}</span>
          </div>
        ) : null}
      </NodeChrome>
      <OrderedSourcePorts nodeId={id} />
    </div>
  )
})
