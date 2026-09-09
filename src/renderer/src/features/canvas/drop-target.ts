import { getNodeAbsoluteBox, isLoopStartNode, pointInBox } from '@/core/graph'
import { getKindForNodeType, getOperator, hasOperator } from '@/core/registry'
import type { FlowNode, XYPosition } from '@/core/types'

function isNoteNode(node: FlowNode): boolean {
  if (node.type === 'noteNode') return true
  if (hasOperator(node.data.label) && getOperator(node.data.label).kind === 'note') return true
  return getKindForNodeType(node.type) === 'note'
}

/** 便签没有连线；loop-start 只有出口，不能当落点。 */
export function isIgnoredConnectTarget(node: FlowNode): boolean {
  return isNoteNode(node) || isLoopStartNode(node)
}

/** 指针落在便签上（便签叠在其它节点之上时仍算命中便签）。 */
export function findNoteAtPoint(point: XYPosition, nodes: FlowNode[]): FlowNode | null {
  let best: FlowNode | null = null
  let bestIndex = -1
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || !isNoteNode(node)) continue
    if (!pointInBox(point, getNodeAbsoluteBox(node, nodes))) continue
    if (index >= bestIndex) {
      best = node
      bestIndex = index
    }
  }
  return best
}

export function pointHitsNode(point: XYPosition, nodes: FlowNode[], nodeId: string): boolean {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return false
  return pointInBox(point, getNodeAbsoluteBox(node, nodes))
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

/** 与画布 `connectionRadius` 对齐：只向左扩，覆盖探出的入口。 */
export const CONNECT_DROP_PAD = 36

function leftPaddedBox(box: { x: number; y: number; width: number; height: number }, pad: number): typeof box {
  return {
    x: box.x - pad,
    y: box.y,
    width: box.width + pad,
    height: box.height
  }
}

function isDescendantOf(node: FlowNode, ancestorId: string, byId: Map<string, FlowNode>): boolean {
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    if (parentId === ancestorId) return true
    seen.add(parentId)
    parentId = byId.get(parentId)?.parentId
  }
  return false
}

/** 落点落在起点自身或其所在容器体内时，垫片不得吸走容器外的节点。 */
function padScopeAncestor(
  point: XYPosition,
  excluded: ReadonlySet<string>,
  nodes: FlowNode[],
  byId: Map<string, FlowNode>
): string | null {
  let bestId: string | null = null
  let bestDepth = -1
  for (const id of excluded) {
    const node = byId.get(id)
    if (!node) continue
    if (!pointInBox(point, getNodeAbsoluteBox(node, nodes))) continue
    const depth = parentDepth(node, byId)
    if (depth > bestDepth) {
      bestDepth = depth
      bestId = id
    }
  }
  return bestId
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

/** 起点在容器内、落点却在该容器框之外：在容器外新建节点或接到容器外的组件。 */
export function dropLeavesContainer(point: XYPosition, nodes: FlowNode[], sourceId: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const parentId = byId.get(sourceId)?.parentId
  const parent = parentId ? byId.get(parentId) : undefined
  if (!parent) return false
  return !pointInBox(point, getNodeAbsoluteBox(parent, nodes))
}

/**
 * 落点命中：排除便签；先取未扩盒，再退到左侧入口垫片。
 * 多层重叠取最深，同深度取更上层（数组更靠后）。
 * 传入 `sourceId` 时，起点自身及其所在的容器不参与命中——这些位置应视为空白，交给新建算子的选择器。
 */
export function pickDropTargetNode(point: XYPosition, nodes: FlowNode[], sourceId?: string): FlowNode | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const excluded = sourceId ? ancestorChain(sourceId, byId) : new Set<string>()
  const exact: { node: FlowNode; index: number; depth: number }[] = []
  const padded: { node: FlowNode; index: number; depth: number }[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || isIgnoredConnectTarget(node) || excluded.has(node.id)) continue
    const box = getNodeAbsoluteBox(node, nodes)
    const depth = parentDepth(node, byId)
    if (pointInBox(point, box)) {
      exact.push({ node, index, depth })
      continue
    }
    if (pointInBox(point, leftPaddedBox(box, CONNECT_DROP_PAD))) {
      padded.push({ node, index, depth })
    }
  }
  const scope = exact.length > 0 ? null : padScopeAncestor(point, excluded, nodes, byId)
  const hits =
    exact.length > 0
      ? exact
      : scope
        ? padded.filter((hit) => isDescendantOf(hit.node, scope, byId))
        : padded
  if (hits.length === 0) return null
  hits.sort((a, b) => b.depth - a.depth || b.index - a.index)
  return hits[0]?.node ?? null
}
