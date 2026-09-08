import { nanoid } from 'nanoid'
import { deepClone } from '../clone'
import type { FlowEdge, FlowNode, XYPosition } from '../types'
import { collectDescendantIds } from './containers'
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

function sortParentsFirst(nodes: FlowNode[]): FlowNode[] {
  const ids = new Set(nodes.map((node) => node.id))
  return [...nodes].sort((left, right) => {
    const leftNested = left.parentId && ids.has(left.parentId) ? 1 : 0
    const rightNested = right.parentId && ids.has(right.parentId) ? 1 : 0
    return leftNested - rightNested
  })
}

export function remapClipboard(
  payload: ClipboardGraph,
  existingNodes: FlowNode[],
  offset: XYPosition
): ClipboardGraph {
  const idMap = new Map<string, string>()
  const working = [...existingNodes]
  const existingIds = new Set(existingNodes.map((node) => node.id))

  const nodes = sortParentsFirst(payload.nodes.filter((node) => !isStartNode(node))).map((node) => {
    let newId: string
    if (isLoopStartNode(node) && node.parentId) {
      const mappedParent = idMap.get(node.parentId)
      newId = mappedParent ? `${mappedParent}:start` : createNodeId('loop-start')
    } else {
      newId = createNodeId(node.data.label)
    }
    idMap.set(node.id, newId)

    const parentInPayload = node.parentId ? idMap.has(node.parentId) : false
    const mappedParent = node.parentId ? idMap.get(node.parentId) : undefined
    const keepOriginalParent = Boolean(node.parentId && !parentInPayload && existingIds.has(node.parentId))
    const nextParent = mappedParent ?? (keepOriginalParent ? node.parentId : undefined)

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
      position: nextParent
        ? parentInPayload
          ? { ...node.position }
          : { x: node.position.x + offset.x, y: node.position.y + offset.y }
        : { x: node.position.x + offset.x, y: node.position.y + offset.y }
    }

    if (nextParent) {
      next.parentId = nextParent
    } else {
      delete next.parentId
    }

    working.push(next)
    return next
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
