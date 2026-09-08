import { nanoid } from 'nanoid'
import type { FlowNode } from '../types'

export function createNodeId(prefix = 'node'): string {
  return `${prefix}:${nanoid(8)}`
}

export function nextNodeName(nodes: FlowNode[], operator: string): string {
  const prefix = `${operator}_`
  const used = new Set(nodes.map((node) => node.data.name))
  let max = 0
  for (const node of nodes) {
    if (node.data.label !== operator) continue
    const name = node.data.name
    if (!name.startsWith(prefix)) continue
    const rest = name.slice(prefix.length)
    if (!/^[0-9]+$/.test(rest)) continue
    const parsed = Number.parseInt(rest, 10)
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed
    }
  }
  let next = max + 1
  while (used.has(`${prefix}${next}`)) {
    next += 1
  }
  return `${prefix}${next}`
}
