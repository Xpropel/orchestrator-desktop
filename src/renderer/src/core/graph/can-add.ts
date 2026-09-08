import { getOperator, hasOperator } from '../registry'
import type { FlowNode } from '../types'

export function canAddOperator(type: string, nodes: FlowNode[], parentId?: string): boolean {
  if (!hasOperator(type)) return false
  const def = getOperator(type)
  if (def.kind === 'loopStart') return false
  const max = def.constraints?.maxInstances
  if (typeof max === 'number' && nodes.filter((node) => node.data.label === type).length >= max) {
    return false
  }
  if (def.constraints?.onlyInsideContainer && !parentId) {
    return false
  }
  return true
}
