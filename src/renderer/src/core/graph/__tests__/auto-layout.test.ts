import { beforeAll, describe, expect, it } from 'vitest'
import { loadLibrary } from '../../library'
import type { FlowEdge, FlowNode } from '../../types'
import { computeAutoLayout } from '../auto-layout'

beforeAll(() => {
  loadLibrary()
})

function node(id: string, label: string, extras?: Partial<FlowNode>): FlowNode {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label, name: id, form: {} },
    ...extras
  }
}

function edge(source: string, target: string): FlowEdge {
  return { id: `${source}->${target}`, source, target, sourceHandle: 'start', targetHandle: 'end' }
}

describe('computeAutoLayout', () => {
  it('lays out top-level nodes left to right', () => {
    const nodes = [
      node('start', 'start', { type: 'startNode', width: 140, height: 44 }),
      node('a', 'agent', { type: 'taskNode', width: 240, height: 80 }),
      node('end', 'end', { type: 'endNode', width: 120, height: 44 })
    ]
    const { positions } = computeAutoLayout(nodes, [edge('start', 'a'), edge('a', 'end')])
    expect(positions.start.x).toBeLessThan(positions.a.x)
    expect(positions.a.x).toBeLessThan(positions.end.x)
  })

  it('keeps container children inside the container and grows the container to fit', () => {
    const nodes = [
      node('start', 'start', { type: 'startNode', width: 140, height: 44 }),
      node('loop', 'foreach', { type: 'containerNode', width: 360, height: 220 }),
      node('loop:start', 'loop-start', { type: 'loopStartNode', parentId: 'loop', width: 28, height: 28 }),
      node('h', 'http', { type: 'taskNode', parentId: 'loop', width: 240, height: 80 }),
      node('a', 'agent', { type: 'taskNode', parentId: 'loop', width: 240, height: 80 }),
      node('b', 'agent', { type: 'taskNode', parentId: 'loop', width: 240, height: 80 }),
      node('end', 'end', { type: 'endNode', width: 120, height: 44 })
    ]
    const edges = [
      edge('start', 'loop'),
      edge('loop:start', 'h'),
      edge('h', 'a'),
      edge('a', 'b'),
      edge('loop', 'end')
    ]
    const { positions, sizes } = computeAutoLayout(nodes, edges)
    const box = sizes.loop
    expect(box).toBeDefined()
    // 三个任务节点横向排开，容器必须放大到能装下
    expect(box.width).toBeGreaterThan(360)
    for (const id of ['loop:start', 'h', 'a', 'b']) {
      const child = nodes.find((item) => item.id === id)
      const pos = positions[id]
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.x + (child?.width ?? 0)).toBeLessThanOrEqual(box.width)
      expect(pos.y + (child?.height ?? 0)).toBeLessThanOrEqual(box.height)
    }
    // 顶层布局使用容器的新尺寸：end 在容器右侧之外
    expect(positions.end.x).toBeGreaterThanOrEqual(positions.loop.x + box.width)
  })
})
