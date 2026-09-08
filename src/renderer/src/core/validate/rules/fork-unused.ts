import type { FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import { collectFormReferences, knownNodeNames } from '../../variables'
import { issue, type FlowIssue } from '../issue'

export function ruleForkUnused(node: FlowNode, operator: OperatorDefinition, nodes: FlowNode[]): FlowIssue[] {
  if (operator.type !== 'session-fork') return []
  const forkName = node.data.name
  const referenced = nodes.some((other) => {
    if (other.id === node.id) return false
    return collectFormReferences(other.data.form, knownNodeNames(nodes)).some(
      (ref) => ref.node === forkName && ref.variable === 'session'
    )
  })
  if (referenced) return []
  return [issue('warning', 'FORK_UNUSED', 'session-fork 的输出没有被任何下游引用', { nodeId: node.id })]
}
