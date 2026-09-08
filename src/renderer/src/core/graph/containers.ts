import { getKindForNodeType, getOperator, hasOperator } from '../registry'
import type { FlowNode, XYPosition } from '../types'
import { isContainerNode, isLoopStartNode, isProtectedNode, isStartNode } from './kind'

export const LOOP_START_POSITION: XYPosition = { x: 24, y: 56 }
export const CONTAINER_MIN_WIDTH = 360
export const CONTAINER_MIN_HEIGHT = 220
export const CONTAINER_DEFAULT_WIDTH = 560
export const CONTAINER_DEFAULT_HEIGHT = 340
export const CONTAINER_DROP_OVERLAP = 0.5

export interface NodeBox {
  x: number
  y: number
  width: number
  height: number
}

export function getNodeCenterOffset(type: string): XYPosition {
  if (!hasOperator(type)) {
    return { x: 120, y: 44 }
  }
  switch (getOperator(type).kind) {
    case 'start':
    case 'end':
      return { x: 70, y: 22 }
    case 'note':
      return { x: 100, y: 70 }
    case 'branch':
      return { x: 120, y: 64 }
    case 'container':
      return { x: CONTAINER_DEFAULT_WIDTH / 2, y: CONTAINER_DEFAULT_HEIGHT / 2 }
    case 'loopStart':
      return { x: 10, y: 10 }
    case 'break':
      return { x: 44, y: 22 }
    default:
      return { x: 120, y: 44 }
  }
}

export function estimateNodeSize(type: string): { width: number; height: number } {
  if (!hasOperator(type)) {
    return { width: 240, height: 80 }
  }
  switch (getOperator(type).kind) {
    case 'start':
    case 'end':
      return { width: 140, height: 44 }
    case 'note':
      return { width: 200, height: 140 }
    case 'branch':
      return { width: 240, height: 128 }
    case 'container':
      return { width: CONTAINER_DEFAULT_WIDTH, height: CONTAINER_DEFAULT_HEIGHT }
    case 'loopStart':
      return { width: 20, height: 20 }
    case 'break':
      return { width: 88, height: 44 }
    default:
      return { width: 240, height: 80 }
  }
}

export function flowCenterFromViewport(
  viewport: { x: number; y: number; zoom: number },
  width: number,
  height: number
): XYPosition {
  return {
    x: (-viewport.x + width / 2) / viewport.zoom,
    y: (-viewport.y + height / 2) / viewport.zoom
  }
}

export function getNodeAbsolutePosition(node: FlowNode, nodes: FlowNode[]): XYPosition {
  let x = node.position.x
  let y = node.position.y
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const seen = new Set<string>()
  let parentId = node.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

export function toRelativePosition(absolute: XYPosition, parent: FlowNode, nodes: FlowNode[]): XYPosition {
  const parentAbs = getNodeAbsolutePosition(parent, nodes)
  return { x: absolute.x - parentAbs.x, y: absolute.y - parentAbs.y }
}

export function toAbsolutePosition(relative: XYPosition, parent: FlowNode, nodes: FlowNode[]): XYPosition {
  const parentAbs = getNodeAbsolutePosition(parent, nodes)
  return { x: relative.x + parentAbs.x, y: relative.y + parentAbs.y }
}

export function getNodeAbsoluteBox(node: FlowNode, nodes: FlowNode[]): NodeBox {
  const position = getNodeAbsolutePosition(node, nodes)
  const fallback =
    getKindForNodeType(node.type) === 'container'
      ? { width: CONTAINER_DEFAULT_WIDTH, height: CONTAINER_DEFAULT_HEIGHT }
      : { width: 240, height: 80 }
  const width = node.measured?.width ?? node.width ?? fallback.width
  const height = node.measured?.height ?? node.height ?? fallback.height
  return { x: position.x, y: position.y, width, height }
}

export function pointInBox(point: XYPosition, box: NodeBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  )
}

export function collectDescendantIds(nodes: FlowNode[], rootId: string): string[] {
  const children = new Map<string, string[]>()
  for (const node of nodes) {
    if (!node.parentId) continue
    const list = children.get(node.parentId) ?? []
    list.push(node.id)
    children.set(node.parentId, list)
  }
  const result: string[] = []
  const stack = [...(children.get(rootId) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) continue
    result.push(id)
    const nested = children.get(id)
    if (nested) stack.push(...nested)
  }
  return result
}

export function findContainingContainer(
  point: XYPosition,
  nodes: FlowNode[],
  options?: { excludeIds?: ReadonlySet<string> }
): FlowNode | null {
  let best: FlowNode | null = null
  let bestArea = Number.POSITIVE_INFINITY
  for (const node of nodes) {
    if (!isContainerNode(node)) continue
    if (options?.excludeIds?.has(node.id)) continue
    const box = getNodeAbsoluteBox(node, nodes)
    if (!pointInBox(point, box)) continue
    const area = box.width * box.height
    if (area < bestArea) {
      best = node
      bestArea = area
    }
  }
  return best
}

export function overlapRatio(a: NodeBox, b: NodeBox): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (width <= 0 || height <= 0 || a.width <= 0 || a.height <= 0) {
    return 0
  }
  return (width * height) / (a.width * a.height)
}

export function findIntersectingContainer(
  node: FlowNode,
  nodes: FlowNode[],
  pointer?: XYPosition
): FlowNode | null {
  if (isContainerNode(node) || isLoopStartNode(node) || isStartNode(node)) {
    return null
  }
  const exclude = new Set<string>([node.id, ...collectDescendantIds(nodes, node.id)])
  if (pointer) {
    const byPointer = findContainingContainer(pointer, nodes, { excludeIds: exclude })
    if (byPointer) {
      return byPointer
    }
  }
  const box = getNodeAbsoluteBox(node, nodes)
  let best: FlowNode | null = null
  let bestRatio = 0
  for (const candidate of nodes) {
    if (!isContainerNode(candidate) || exclude.has(candidate.id)) continue
    const ratio = overlapRatio(box, getNodeAbsoluteBox(candidate, nodes))
    if (ratio >= CONTAINER_DROP_OVERLAP && ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
  }
  return best
}

/** 拖放结束后是否改归属。返回 null 表示保持现状。指针优先，重叠兜底。 */
export function resolveParentAfterDrag(
  node: FlowNode,
  nodes: FlowNode[],
  pointer?: XYPosition
): { parentId: string | null; position: XYPosition } | null {
  if (isStartNode(node) || isProtectedNode(node, nodes) || isContainerNode(node)) return null
  const hit = findIntersectingContainer(node, nodes, pointer)
  const abs = getNodeAbsolutePosition(node, nodes)
  if (hit && node.parentId !== hit.id) {
    return { parentId: hit.id, position: toRelativePosition(abs, hit, nodes) }
  }
  if (!hit && node.parentId) {
    return { parentId: null, position: abs }
  }
  return null
}

function boxesOverlap(a: NodeBox, b: NodeBox, gap: number): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

export function findNonOverlappingPosition(
  start: XYPosition,
  nodes: FlowNode[],
  size: { width: number; height: number },
  gap = 24
): XYPosition {
  const boxes = nodes.filter((node) => !node.parentId).map((node) => getNodeAbsoluteBox(node, nodes))
  const stepX = 280
  const stepY = size.height + gap
  const maxSteps = 20

  for (let row = 0; row < maxSteps; row += 1) {
    for (let col = 0; col < maxSteps; col += 1) {
      const candidate = { x: start.x + col * stepX, y: start.y + row * stepY }
      const box = { ...candidate, ...size }
      const hits = boxes.some((existing) => boxesOverlap(box, existing, gap))
      if (!hits) {
        return candidate
      }
    }
  }
  return start
}
