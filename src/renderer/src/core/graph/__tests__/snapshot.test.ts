import { describe, expect, it } from 'vitest'
import type { FlowEdge, FlowNode } from '../../types'
import { cloneGraph, graphsEqual, snapshotKeyOf, stripRuntimeFields } from '../snapshot'

function node(extras: Partial<FlowNode> = {}): FlowNode {
  return {
    id: 'n1',
    type: 'taskNode',
    position: { x: 10, y: 20 },
    data: { label: 'agent', name: 'a', form: {} },
    ...extras
  }
}

function edge(extras: Partial<FlowEdge> = {}): FlowEdge {
  return { id: 'e1', source: 'a', target: 'b', ...extras }
}

describe('stripRuntimeFields', () => {
  it('drops selected/dragging/measured and keeps position plus explicit size', () => {
    const stripped = stripRuntimeFields(
      [
        node({
          selected: true,
          dragging: true,
          measured: { width: 99, height: 40 },
          width: 240,
          height: 80
        })
      ],
      [edge({ selected: true })]
    )
    expect(stripped.nodes[0]?.selected).toBeUndefined()
    expect(stripped.nodes[0]?.dragging).toBeUndefined()
    expect(stripped.nodes[0]?.measured).toBeUndefined()
    expect(stripped.nodes[0]?.position).toEqual({ x: 10, y: 20 })
    expect(stripped.nodes[0]?.width).toBe(240)
    expect(stripped.edges[0]?.selected).toBeUndefined()
  })

  it('keeps snapshot keys stable when only runtime fields change', () => {
    const base = cloneGraph([node()], [edge()], 'T', {})
    const measured = cloneGraph([node({ selected: true, measured: { width: 1, height: 1 } })], [edge()], 'T', {})
    expect(graphsEqual(base, measured)).toBe(true)
    expect(snapshotKeyOf(base)).toBe(snapshotKeyOf(measured))
  })
})
