import { getNodeAbsoluteBox, pointInBox } from '@/core/graph'
import { getKindForNodeType, getOperator, hasOperator } from '@/core/registry'
import type { FlowNode, XYPosition } from '@/core/types'

function isNoteNode(node: FlowNode): boolean {
  if (node.type === 'noteNode') return true
  if (hasOperator(node.data.label) && getOperator(node.data.label).kind === 'note') return true
  return getKindForNodeType(node.type) === 'note'
}

function parentDepth(node: FlowNode, byId: Map<string, FlowNode>): number {
  let depth = 0
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    depth += 1
    parentId = byId.get(parentId)?.parentId
  }
  return depth
}

/** 把 React Flow 测到的尺寸叠到 store 节点上，供落点命中使用。 */
export function mergeNodeMetrics(storeNodes: FlowNode[], measured: FlowNode[]): FlowNode[] {
  if (measured.length === 0) return storeNodes
  const byId = new Map(measured.map((node) => [node.id, node]))
  return storeNodes.map((node) => {
    const extra = byId.get(node.id)
    if (!extra) return node
    return {
      ...node,
      position: extra.position ?? node.position,
      measured: extra.measured ?? node.measured,
      width: extra.width ?? node.width,
      height: extra.height ?? node.height
    }
  })
}

/** 落点命中：排除便签；多层重叠取最深，同深度取更上层（数组更靠后）。 */
export function pickDropTargetNode(point: XYPosition, nodes: FlowNode[]): FlowNode | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const hits: { node: FlowNode; index: number; depth: number }[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || isNoteNode(node)) continue
    if (!pointInBox(point, getNodeAbsoluteBox(node, nodes))) continue
    hits.push({ node, index, depth: parentDepth(node, byId) })
  }
  if (hits.length === 0) return null
  hits.sort((a, b) => b.depth - a.depth || b.index - a.index)
  return hits[0]?.node ?? null
}
