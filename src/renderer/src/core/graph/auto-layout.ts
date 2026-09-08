import dagre from '@dagrejs/dagre'
import type { FlowEdge, FlowNode } from '../types'
import { CONTAINER_PORT_GUTTER, getNodeBoxSize } from './containers'

const FALLBACK_WIDTH = 240
const FALLBACK_HEIGHT = 80
/** 容器内部留白：左/右/下，以及顶部标题栏高度。 */
const CONTAINER_PADDING_X = 24
const CONTAINER_PADDING_BOTTOM = 24
const CONTAINER_HEADER = 56
const CONTAINER_MIN_WIDTH = 360
const CONTAINER_MIN_HEIGHT = 220

export interface LayoutResult {
  /** 顶层节点为绝对坐标；容器子节点为相对容器的坐标。 */
  positions: Record<string, { x: number; y: number }>
  /** 自适应后的容器尺寸（包住全部子节点 + 内边距，不小于最小尺寸）。 */
  sizes: Record<string, { width: number; height: number }>
}

function nodeSize(node: FlowNode, sizes: Record<string, { width: number; height: number }>): {
  width: number
  height: number
} {
  const resized = sizes[node.id]
  if (resized) return resized
  return getNodeBoxSize(node)
}

function layoutLevel(
  nodes: FlowNode[],
  edges: FlowEdge[],
  sizes: Record<string, { width: number; height: number }>
): Record<string, { x: number; y: number; width: number; height: number }> {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 })

  const ids = new Set(nodes.map((node) => node.id))
  for (const node of nodes) {
    graph.setNode(node.id, nodeSize(node, sizes))
  }
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      graph.setEdge(edge.source, edge.target)
    }
  }
  dagre.layout(graph)

  const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {}
  for (const node of nodes) {
    const laid = graph.node(node.id)
    if (!laid) continue
    const width = laid.width ?? FALLBACK_WIDTH
    const height = laid.height ?? FALLBACK_HEIGHT
    boxes[node.id] = { x: laid.x - width / 2, y: laid.y - height / 2, width, height }
  }
  return boxes
}

/**
 * 两层自动布局：先逐个容器布局其直接子节点（得到相对坐标并自适应容器尺寸），
 * 再用新尺寸把容器当作普通盒子参与顶层布局。子节点始终留在容器盒内。
 */
export function computeAutoLayout(nodes: FlowNode[], edges: FlowEdge[]): LayoutResult {
  const positions: Record<string, { x: number; y: number }> = {}
  const sizes: Record<string, { width: number; height: number }> = {}

  const childrenByParent = new Map<string, FlowNode[]>()
  for (const node of nodes) {
    if (!node.parentId) continue
    const list = childrenByParent.get(node.parentId) ?? []
    list.push(node)
    childrenByParent.set(node.parentId, list)
  }

  for (const [parentId, children] of childrenByParent) {
    const boxes = layoutLevel(children, edges, sizes)
    const laid = Object.values(boxes)
    if (laid.length === 0) continue
    const minX = Math.min(...laid.map((box) => box.x))
    const minY = Math.min(...laid.map((box) => box.y))
    let maxRight = 0
    let maxBottom = 0
    for (const child of children) {
      const box = boxes[child.id]
      if (!box) continue
      const x = box.x - minX + CONTAINER_PADDING_X
      const y = box.y - minY + CONTAINER_HEADER
      positions[child.id] = { x, y }
      maxRight = Math.max(maxRight, x + box.width)
      maxBottom = Math.max(maxBottom, y + box.height)
    }
    sizes[parentId] = {
      width: Math.max(CONTAINER_MIN_WIDTH, Math.ceil(maxRight + CONTAINER_PORT_GUTTER)),
      height: Math.max(CONTAINER_MIN_HEIGHT, Math.ceil(maxBottom + CONTAINER_PADDING_BOTTOM))
    }
  }

  const topLevel = nodes.filter((node) => !node.parentId)
  const topBoxes = layoutLevel(topLevel, edges, sizes)
  for (const node of topLevel) {
    const box = topBoxes[node.id]
    if (box) positions[node.id] = { x: box.x, y: box.y }
  }

  return { positions, sizes }
}
