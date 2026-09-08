import { nanoid } from 'nanoid'
import type { FlowNode } from '../types'

export function createNodeId(prefix = 'node'): string {
  return `${prefix}:${nanoid(8)}`
}

export function nextNodeName(nodes: FlowNode[], operator: string): string {
  const prefix = `${operator}_`
  let max = 0
  for (const node of nodes) {
    if (node.data.label !== operator) continue
    const name = node.data.name
    if (!name.startsWith(prefix)) continue
    const parsed = Number.parseInt(name.slice(prefix.length), 10)
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed
    }
  }
  return `${prefix}${max + 1}`
}
