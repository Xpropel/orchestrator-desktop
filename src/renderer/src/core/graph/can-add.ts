import { getOperator, hasOperator } from '../registry'
import type { FlowNode } from '../types'
import { isContainerNode } from './kind'

export function canAddOperator(type: string, nodes: FlowNode[], parentId?: string): boolean {
  if (!hasOperator(type)) return false
  const def = getOperator(type)
  if (def.kind === 'loopStart') return false
  if (def.kind === 'container' && parentId) return false
  const max = def.constraints?.maxInstances
  if (typeof max === 'number' && nodes.filter((node) => node.data.label === type).length >= max) {
    return false
  }
  if (def.constraints?.onlyInsideContainer) {
    if (!parentId) return false
    const parent = nodes.find((node) => node.id === parentId)
    if (!parent || !isContainerNode(parent)) return false
  }
  return true
}
