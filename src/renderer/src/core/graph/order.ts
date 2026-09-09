import type { FlowNode } from '../types'

function ancestryDepth(node: FlowNode, byId: Map<string, FlowNode>): number {
  let depth = 0
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && byId.has(parentId) && !seen.has(parentId)) {
    seen.add(parentId)
    depth += 1
    parentId = byId.get(parentId)?.parentId
  }
  return depth
}

/**
 * React Flow 要求父节点排在子节点前面，否则会丢掉 parentId，关窗再开后
 * 母组件右侧 + 量不到、也无法向子节点拉线。
 */
export function sortParentsBeforeChildren<T extends FlowNode>(nodes: T[]): T[] {
  if (nodes.length < 2) return nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const indexOf = new Map(nodes.map((node, index) => [node.id, index]))
  const sorted = [...nodes].sort((left, right) => {
    const delta = ancestryDepth(left, byId) - ancestryDepth(right, byId)
    if (delta !== 0) return delta
    return (indexOf.get(left.id) ?? 0) - (indexOf.get(right.id) ?? 0)
  })
  if (sorted.every((node, index) => node.id === nodes[index]?.id)) return nodes
  return sorted
}
