import { parentIdOf } from './parent-id'
import type { FlowConnection, FlowEdge, FlowNode } from '../types'

export function buildAdjacency(nodes: FlowNode[], edges: FlowEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    const list = adjacency.get(edge.source)
    if (list) {
      list.push(edge.target)
    } else {
      adjacency.set(edge.source, [edge.target])
    }
  }
  return adjacency
}

export function canReach(adjacency: Map<string, string[]>, from: string, to: string): boolean {
  if (from === to) return true
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || seen.has(current)) continue
    if (current === to) return true
    seen.add(current)
    const next = adjacency.get(current)
    if (next) stack.push(...next)
  }
  return false
}

export function reachableFrom(nodes: FlowNode[], edges: FlowEdge[], startIds: string[]): Set<string> {
  const known = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.source)
    if (list) list.push(edge.target)
    else outgoing.set(edge.source, [edge.target])
  }
  const seen = new Set<string>()
  const stack = [...startIds]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || seen.has(current) || !known.has(current)) continue
    seen.add(current)
    const next = outgoing.get(current)
    if (next) stack.push(...next)
  }
  return seen
}

export function getUpstreamNodeIds(nodeId: string, nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const known = new Set(nodes.map((node) => node.id))
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    const list = incoming.get(edge.target)
    if (list) list.push(edge.source)
    else incoming.set(edge.target, [edge.source])
  }
  const visited = new Set<string>()
  const stack = [...(incoming.get(nodeId) ?? [])]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current) || !known.has(current)) continue
    visited.add(current)
    const parents = incoming.get(current)
    if (parents) stack.push(...parents)
  }
  return [...visited]
}

export function wouldCreateCycle(nodes: FlowNode[], edges: FlowEdge[], connection: FlowConnection): boolean {
  if (!connection.source || !connection.target) return false
  if (connection.source === connection.target) return true

  const adjacency = buildAdjacency(nodes, edges)
  const fromSource = adjacency.get(connection.source)
  if (fromSource) {
    fromSource.push(connection.target)
  } else {
    adjacency.set(connection.source, [connection.target])
  }

  return canReach(adjacency, connection.target, connection.source)
}

export function detectTopLevelCycle(nodes: FlowNode[], edges: FlowEdge[]): boolean {
  const map = new Map(nodes.map((node) => [node.id, node]))
  const collapsed = (id: string): string => {
    const node = map.get(id)
    if (!node) return id
    const parent = parentIdOf(node)
    return parent ?? id
  }
  const graph = new Map<string, Set<string>>()
  const ensure = (id: string): Set<string> => {
    const existing = graph.get(id)
    if (existing) return existing
    const created = new Set<string>()
    graph.set(id, created)
    return created
  }
  for (const node of nodes) {
    if (!parentIdOf(node)) ensure(node.id)
  }
  for (const edge of edges) {
    const from = collapsed(edge.source)
    const to = collapsed(edge.target)
    if (from === to) continue
    ensure(from).add(to)
    ensure(to)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): boolean => {
    if (visited.has(id)) return false
    if (visiting.has(id)) return true
    visiting.add(id)
    for (const next of graph.get(id) ?? []) {
      if (visit(next)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  for (const id of graph.keys()) {
    if (visit(id)) return true
  }
  return false
}
