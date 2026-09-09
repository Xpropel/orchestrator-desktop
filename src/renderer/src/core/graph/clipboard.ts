import { nanoid } from 'nanoid'
import { deepClone } from '../clone'
import type { FlowEdge, FlowNode, XYPosition } from '../types'
import {
  clampPositionInsideParent,
  collectDescendantIds,
  mustRemainInsideContainer,
  toAbsolutePosition
} from './containers'
import { isContainerNode, isLoopStartNode, isStartNode } from './kind'
import { createNodeId, nextNodeName } from './naming'

export interface ClipboardGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export function expandCopyIds(nodes: FlowNode[], selectedIds: Iterable<string>): string[] {
  const selected = new Set(selectedIds)
  const result = new Set<string>()
  for (const id of selected) {
    const node = nodes.find((item) => item.id === id)
    if (!node) continue
    if (isStartNode(node)) continue
    if (isLoopStartNode(node)) continue
    result.add(id)
    if (isContainerNode(node)) {
      for (const childId of collectDescendantIds(nodes, id)) {
        result.add(childId)
      }
    }
  }
  return [...result]
}

export function extractSubgraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  selectedIds: Iterable<string>
): ClipboardGraph {
  const idSet = new Set(expandCopyIds(nodes, selectedIds))
  const selected = nodes.filter((node) => idSet.has(node.id))
  const selectedSet = new Set(selected.map((node) => node.id))
  const selectedEdges = edges.filter((edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target))
  return {
    nodes: deepClone(selected),
    edges: deepClone(selectedEdges)
  }
}

export interface RemapClipboardOptions {
  /** 剪贴板里没有父容器的节点贴到这里；`null` 表示顶层。省略则尽量留在原容器。 */
  targetParentId?: string | null
}

/** 根据当前选区决定粘贴落点，避免副本继续挂在被复制的原容器上。 */
export function resolvePasteParentId(
  payload: ClipboardGraph,
  nodes: FlowNode[],
  selectedIds: readonly string[]
): string | null | undefined {
  const payloadIds = new Set(payload.nodes.map((node) => node.id))
  const selected = selectedIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is FlowNode => node != null)

  if (selected.length === 0 || selected.every((node) => isStartNode(node))) {
    return null
  }

  const targetContainer = selected.find((node) => isContainerNode(node) && !payloadIds.has(node.id))
  if (targetContainer) return targetContainer.id

  const anchors = selected.filter((node) => !payloadIds.has(node.id) && !isStartNode(node))
  const parents = new Set(anchors.map((node) => node.parentId ?? null))
  if (anchors.length > 0 && parents.size === 1) {
    const parentId = [...parents][0]
    if (parentId) return parentId
  }

  return undefined
}

function clipboardAbsolutePosition(node: FlowNode, existingNodes: FlowNode[]): XYPosition {
  if (!node.parentId) return { ...node.position }
  const parent = existingNodes.find((item) => item.id === node.parentId)
  if (!parent) return { ...node.position }
  return toAbsolutePosition(node.position, parent, existingNodes)
}

function ancestryDepth(node: FlowNode, ids: ReadonlySet<string>, byId: Map<string, FlowNode>): number {
  let depth = 0
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && ids.has(parentId) && !seen.has(parentId)) {
    seen.add(parentId)
    depth += 1
    parentId = byId.get(parentId)?.parentId
  }
  return depth
}

function sortParentsFirst(nodes: FlowNode[]): FlowNode[] {
  const ids = new Set(nodes.map((node) => node.id))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return [...nodes].sort((left, right) => ancestryDepth(left, ids, byId) - ancestryDepth(right, ids, byId))
}

export function remapClipboard(
  payload: ClipboardGraph,
  existingNodes: FlowNode[],
  offset: XYPosition,
  options?: RemapClipboardOptions
): ClipboardGraph {
  const idMap = new Map<string, string>()
  const working = [...existingNodes]
  const existingIds = new Set(existingNodes.map((node) => node.id))
  const payloadIds = new Set(payload.nodes.map((node) => node.id))
  const retarget = options?.targetParentId !== undefined

  const nodes = sortParentsFirst(payload.nodes.filter((node) => !isStartNode(node))).flatMap((node) => {
    const parentInPayload = Boolean(node.parentId && payloadIds.has(node.parentId))
    const mappedParent = node.parentId ? idMap.get(node.parentId) : undefined
    const keepOriginalParent = Boolean(node.parentId && !parentInPayload && existingIds.has(node.parentId))
    let nextParent = mappedParent ?? (keepOriginalParent ? node.parentId : undefined)
    if (!parentInPayload && retarget) {
      const wanted = isContainerNode(node) ? undefined : (options?.targetParentId ?? undefined)
      // 顶层粘贴会拆掉 parentId；onlyInsideContainer（如 break）不能落到画布上。
      if (wanted == null && mustRemainInsideContainer(node)) {
        if (!keepOriginalParent) return []
      } else {
        nextParent = wanted
      }
    }

    let newId: string
    if (isLoopStartNode(node) && node.parentId) {
      const mappedForId = idMap.get(node.parentId)
      newId = mappedForId ? `${mappedForId}:start` : createNodeId('loop-start')
    } else {
      newId = createNodeId(node.data.label)
    }
    idMap.set(node.id, newId)

    const shifted = { x: node.position.x + offset.x, y: node.position.y + offset.y }
    let position = nextParent ? (parentInPayload ? { ...node.position } : shifted) : shifted
    if (!nextParent && !parentInPayload && node.parentId) {
      const abs = clipboardAbsolutePosition(node, existingNodes)
      position = { x: abs.x + offset.x, y: abs.y + offset.y }
    }

    const next: FlowNode = {
      ...node,
      id: newId,
      selected: true,
      data: {
        ...node.data,
        name: isLoopStartNode(node)
          ? nextNodeName(working, 'loop-start')
          : nextNodeName(working, node.data.label),
        form: deepClone(node.data.form)
      },
      position
    }

    if (nextParent) {
      next.parentId = nextParent
    } else {
      delete next.parentId
    }
    delete next.extent

    // 孤立节点贴进容器时钳开端口带，与挂上 / 新增 / 留在父内同一套，避免挡住 +。
    if (nextParent && !parentInPayload) {
      const dest = working.find((item) => item.id === nextParent)
      if (dest && isContainerNode(dest)) {
        next.position = clampPositionInsideParent(next, dest)
      }
    }

    working.push(next)
    return [next]
  })

  const edges = payload.edges.flatMap((edge) => {
    const source = idMap.get(edge.source)
    const target = idMap.get(edge.target)
    if (!source || !target) return []
    const next: FlowEdge = {
      ...edge,
      id: `xy-edge_${nanoid(8)}`,
      source,
      target,
      selected: false
    }
    return [next]
  })

  return { nodes, edges }
}
