import { memo, type JSX } from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { parseInputs } from '@/core/form-items'
import { getNodeSummary } from '@/core/graph'
import { getOperator, hasOperator } from '@/core/registry'
import type { BaseNodeData } from '@/core/types'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { FlowHandle } from './flow-handle'
import { NodeChrome } from './node-chrome'
import { OrderedSourcePorts, orderedPortsMinHeight, useStartOutgoingCount } from './ordered-source-ports'

/** 按 constraints.outputsFromParam 列出派生字段名（dataset.fields / start.inputs） */
function derivedFieldNames(data: BaseNodeData): string[] {
  if (!hasOperator(data.label)) return []
  const key = getOperator(data.label).constraints?.outputsFromParam
  if (!key) return []
  return parseInputs(data.form[key])
    .map((item) => item.key)
    .filter((name) => name.length > 0)
}

export const TaskNode = memo(function TaskNode({
  id,
  data,
  selected
}: NodeProps<CanvasNode>): JSX.Element {
  const summary = getNodeSummary(data)
  const def = hasOperator(data.label) ? getOperator(data.label) : null
  const outputCount = def?.outputs.length ?? 0
  const derived = derivedFieldNames(data)
  const occupied = useStartOutgoingCount(id)

  return (
    <div
      data-testid={`node-task-${data.label}`}
      className="relative"
      style={{ minHeight: orderedPortsMinHeight(occupied) }}
    >
      <FlowHandle type="target" id="end" position={Position.Left} />
      <NodeChrome id={id} data={data} selected={selected}>
        {summary ? (
          <div className="border-t border-border px-3 py-1.5 text-[11px] text-secondary">
            <span className="line-clamp-2">{summary}</span>
          </div>
        ) : null}
        {derived.length > 0 ? (
          <div
            data-testid="node-derived-fields"
            className="border-t border-border px-3 py-1 text-[10px] text-secondary"
          >
            {derived.join(' · ')}
          </div>
        ) : null}
        {outputCount > 0 ? (
          <div className="border-t border-border px-3 py-1 text-[10px] text-secondary">
            {outputCount} outputs
          </div>
        ) : null}
      </NodeChrome>
      <OrderedSourcePorts nodeId={id} />
    </div>
  )
})
