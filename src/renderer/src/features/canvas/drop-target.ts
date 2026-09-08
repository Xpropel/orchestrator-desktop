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

/** 连线起点所在的容器链（含起点自身）：从容器内部拉线时，落在容器空白处不算“落到容器上”。 */
function ancestorChain(sourceId: string, byId: Map<string, FlowNode>): Set<string> {
  const chain = new Set<string>([sourceId])
  let parentId = byId.get(sourceId)?.parentId
  while (parentId && !chain.has(parentId)) {
    chain.add(parentId)
    parentId = byId.get(parentId)?.parentId
  }
  return chain
}

export function isSourceOrAncestor(nodes: FlowNode[], sourceId: string, candidateId: string): boolean {
  return ancestorChain(sourceId, new Map(nodes.map((node) => [node.id, node]))).has(candidateId)
}

/** 起点在容器内、落点却在该容器框之外：循环体内的连线不能离开容器，也就不能在容器外新建节点。 */
export function dropLeavesContainer(point: XYPosition, nodes: FlowNode[], sourceId: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const parentId = byId.get(sourceId)?.parentId
  const parent = parentId ? byId.get(parentId) : undefined
  if (!parent) return false
  return !pointInBox(point, getNodeAbsoluteBox(parent, nodes))
}

/**
 * 落点命中：排除便签；多层重叠取最深，同深度取更上层（数组更靠后）。
 * 传入 `sourceId` 时，起点自身及其所在的容器不参与命中——这些位置应视为空白，交给新建算子的选择器。
 */
export function pickDropTargetNode(point: XYPosition, nodes: FlowNode[], sourceId?: string): FlowNode | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const excluded = sourceId ? ancestorChain(sourceId, byId) : new Set<string>()
  const hits: { node: FlowNode; index: number; depth: number }[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || isNoteNode(node) || excluded.has(node.id)) continue
    if (!pointInBox(point, getNodeAbsoluteBox(node, nodes))) continue
    hits.push({ node, index, depth: parentDepth(node, byId) })
  }
  if (hits.length === 0) return null
  hits.sort((a, b) => b.depth - a.depth || b.index - a.index)
  return hits[0]?.node ?? null
}
